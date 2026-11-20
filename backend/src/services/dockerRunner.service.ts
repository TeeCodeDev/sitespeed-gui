import fs from 'node:fs';
import path from 'node:path';
import Docker from 'dockerode';
import { getConfig } from '../config/env.js';
import type { TestRunRecord } from '../db/types.js';

let dockerClient: Docker | null = null;

function getDocker(): Docker {
  if (!dockerClient) {
    const cfg = getConfig();
    dockerClient = new Docker({ socketPath: cfg.DOCKER_SOCKET_PATH });
  }
  return dockerClient;
}

/**
 * Builds a strictly allowlisted Sitespeed.io CLI argument array from validated run parameters.
 * Never accepts arbitrary raw CLI flags from user input.
 */
export function buildSitespeedArgs(run: TestRunRecord, containerOutputDir: string): string[] {
  const args: string[] = [
    run.url,
    '--outputFolder',
    containerOutputDir,
    '--browsertime.iterations',
    String(run.iterations),
    '--browsertime.browser',
    run.browser,
    '--browsertime.connectivity.profile',
    run.connectivity,
    '--browsertime.video',
    'true',
    '--browsertime.visualMetrics',
    'true',
    '--plugins.add',
    'analysisstorer',
    '--copyLatestFilesToBase',
    'false',
  ];

  if (run.mobile === 1) {
    args.push('--mobile', 'true');
  }

  return args;
}

export interface RunExecutionResult {
  exitCode: number;
  errorOutput: string;
}

/**
 * Checks connectivity to the Docker daemon via the configured Unix socket.
 */
export async function checkDockerHealth(): Promise<boolean> {
  try {
    await getDocker().ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Strips Docker's 8-byte multiplexed stream header from non-TTY container log chunks.
 */
function demuxDockerChunk(chunk: Buffer): string {
  const parts: string[] = [];
  let offset = 0;
  while (offset + 8 <= chunk.length) {
    const streamType = chunk[offset];
    if (streamType !== 1 && streamType !== 2) {
      return chunk.toString('utf-8');
    }
    const frameSize = chunk.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = Math.min(start + frameSize, chunk.length);
    parts.push(chunk.subarray(start, end).toString('utf-8'));
    offset = end;
  }
  if (offset < chunk.length && parts.length === 0) {
    return chunk.toString('utf-8');
  }
  return parts.join('');
}

/**
 * Pulls the configured Sitespeed.io image if it is not already present locally.
 */
async function ensureImagePresent(
  docker: Docker,
  image: string,
  appendLog: (line: string) => void
): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    appendLog(`[runner] Image ${image} is present locally.\n`);
  } catch {
    appendLog(`[runner] Pulling image ${image} (first run may take 1-2 minutes)...\n`);
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (progressErr: Error | null) => {
          if (progressErr) return reject(progressErr);
          appendLog(`[runner] Image ${image} pulled successfully.\n`);
          resolve();
        });
      });
    });
  }
}

/**
 * Executes a single Sitespeed.io measurement inside an isolated sibling Docker container,
 * streaming stdout/stderr to runner.log in hostDir.
 */
export async function executeSitespeedContainer(
  run: TestRunRecord,
  hostDir: string,
  onContainerCreated: (containerId: string) => void
): Promise<RunExecutionResult> {
  const cfg = getConfig();
  const docker = getDocker();
  const containerOutputDir = `/sitespeed.io/run-${run.id}`;
  const args = buildSitespeedArgs(run, containerOutputDir);
  const logFilePath = path.join(hostDir, 'runner.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  const appendLog = (text: string) => {
    logStream.write(text);
  };

  try {
    appendLog(`[runner] Preparing run #${run.id} for ${run.url}\n`);
    await ensureImagePresent(docker, cfg.SITESPEED_IMAGE, appendLog);

    appendLog(`[runner] Creating container (${cfg.SITESPEED_IMAGE})...\n`);
    const container = await docker.createContainer({
      Image: cfg.SITESPEED_IMAGE,
      Cmd: args,
      Labels: {
        'sitespeed-gui.run-id': String(run.id),
        'sitespeed-gui.managed': 'true',
      },
      HostConfig: {
        AutoRemove: true,
        ShmSize: cfg.CONTAINER_SHM_MB * 1024 * 1024,
        Memory: cfg.CONTAINER_MEMORY_MB * 1024 * 1024,
        NanoCpus: Math.round(cfg.CONTAINER_CPU_CORES * 1_000_000_000),
        Mounts: [
          {
            Type: 'volume',
            Source: cfg.RESULTS_VOLUME_NAME,
            Target: '/sitespeed.io',
          },
        ],
        SecurityOpt: ['no-new-privileges:true'],
      },
    });

    onContainerCreated(container.id);
    await container.start();
    appendLog(`[runner] Container ${container.id.slice(0, 12)} started.\n`);

    const attachStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });
    attachStream.on('data', (chunk: Buffer) => {
      appendLog(demuxDockerChunk(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    });

    const timeoutHandle = setTimeout(() => {
      appendLog(`[runner] Run timed out after ${cfg.RUN_TIMEOUT_MS}ms; killing container.\n`);
      container.kill().catch(() => {
        // Container may have already exited
      });
    }, cfg.RUN_TIMEOUT_MS);

    try {
      const result = (await container.wait()) as { StatusCode: number };
      appendLog(`[runner] Container exited with status ${result.StatusCode}.\n`);
      return {
        exitCode: result.StatusCode,
        errorOutput: result.StatusCode === 0 ? '' : `Container exited with status ${result.StatusCode}`,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  } finally {
    logStream.end();
  }
}

/**
 * Stops and kills a running Sitespeed.io container by ID.
 */
export async function stopSitespeedContainer(containerId: string): Promise<void> {
  try {
    const container = getDocker().getContainer(containerId);
    await container.kill();
  } catch {
    // Ignore if already stopped/removed
  }
}

/**
 * Resolves the host-visible path inside RESULTS_DIR for a given run.
 */
export function getRunHostDir(runId: number): string {
  const cfg = getConfig();
  return path.join(cfg.RESULTS_DIR, `run-${runId}`);
}

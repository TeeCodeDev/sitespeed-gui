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
 * Pulls the configured Sitespeed.io image if it is not already present locally.
 */
async function ensureImagePresent(docker: Docker, image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
  } catch {
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (progressErr: Error | null) => {
          if (progressErr) return reject(progressErr);
          resolve();
        });
      });
    });
  }
}

/**
 * Executes a single Sitespeed.io measurement inside an isolated sibling Docker container.
 */
export async function executeSitespeedContainer(
  run: TestRunRecord,
  onContainerCreated: (containerId: string) => void
): Promise<RunExecutionResult> {
  const cfg = getConfig();
  const docker = getDocker();
  const containerOutputDir = `/sitespeed.io/run-${run.id}`;
  const args = buildSitespeedArgs(run, containerOutputDir);

  await ensureImagePresent(docker, cfg.SITESPEED_IMAGE);

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

  const timeoutHandle = setTimeout(() => {
    container.kill().catch(() => {
      // Container may have already exited
    });
  }, cfg.RUN_TIMEOUT_MS);

  try {
    const result = (await container.wait()) as { StatusCode: number };
    return {
      exitCode: result.StatusCode,
      errorOutput: result.StatusCode === 0 ? '' : `Container exited with status ${result.StatusCode}`,
    };
  } finally {
    clearTimeout(timeoutHandle);
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

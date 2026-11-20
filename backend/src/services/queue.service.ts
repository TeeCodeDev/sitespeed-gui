import fs from 'node:fs/promises';
import { getConfig } from '../config/env.js';
import { runsDal } from '../dal/runs.dal.js';
import {
  executeSitespeedContainer,
  getRunHostDir,
  stopSitespeedContainer,
} from './dockerRunner.service.js';
import { parseSitespeedResults } from './metricsParser.service.js';

class RunQueueService {
  private activeCount = 0;
  private isProcessing = false;

  /**
   * Triggers queue processing if capacity is available.
   */
  public trigger(): void {
    if (this.isProcessing) return;
    void this.processNext();
  }

  private async processNext(): Promise<void> {
    this.isProcessing = true;
    try {
      const cfg = getConfig();
      while (this.activeCount < cfg.MAX_CONCURRENT_RUNS) {
        const queued = runsDal.listQueued(1);
        if (queued.length === 0) break;

        const run = queued[0];
        this.activeCount += 1;
        void this.executeRun(run.id).finally(() => {
          this.activeCount -= 1;
          this.trigger();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeRun(runId: number): Promise<void> {
    const run = runsDal.getById(runId);
    if (!run || run.status !== 'queued') return;

    const reportRelDir = `run-${run.id}`;
    const hostDir = getRunHostDir(run.id);

    try {
      await fs.mkdir(hostDir, { recursive: true });
      runsDal.markRunning(run.id, null, reportRelDir);

      const execResult = await executeSitespeedContainer(run, (containerId) => {
        runsDal.updateContainerId(run.id, containerId);
      });

      const refreshed = runsDal.getById(run.id);
      if (refreshed?.status === 'cancelled') {
        return;
      }

      if (execResult.exitCode !== 0) {
        runsDal.markFailed(run.id, execResult.errorOutput || 'Sitespeed container failed');
        return;
      }

      const metrics = await parseSitespeedResults(run.id, run.url, hostDir);
      runsDal.upsertMetrics(metrics);
      runsDal.markCompleted(run.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown execution error';
      runsDal.markFailed(run.id, message);
    }
  }

  public async cancelRun(runId: number): Promise<boolean> {
    const run = runsDal.getById(runId);
    if (!run) return false;

    if (run.status === 'queued') {
      runsDal.markCancelled(runId);
      return true;
    }

    if (run.status === 'running') {
      runsDal.markCancelled(runId);
      if (run.container_id) {
        await stopSitespeedContainer(run.container_id);
      }
      return true;
    }

    return false;
  }
}

export const runQueueService = new RunQueueService();

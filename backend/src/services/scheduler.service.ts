import cron, { type ScheduledTask } from 'node-cron';
import { getConfig } from '../config/env.js';
import { runsDal } from '../dal/runs.dal.js';
import { schedulesDal } from '../dal/schedules.dal.js';
import type { ScheduleRecord } from '../db/types.js';
import { runQueueService } from './queue.service.js';
import { validateTargetUrl } from './urlGuard.service.js';

class SchedulerService {
  private tasks = new Map<number, ScheduledTask>();

  /**
   * Loads all enabled schedules from SQLite and registers cron jobs.
   */
  public startAll(): void {
    this.stopAll();
    const enabledSchedules = schedulesDal.listEnabled();
    for (const schedule of enabledSchedules) {
      this.registerSchedule(schedule);
    }
  }

  public stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
  }

  public registerSchedule(schedule: ScheduleRecord): void {
    this.unregisterSchedule(schedule.id);
    if (schedule.enabled !== 1) return;
    if (!cron.validate(schedule.cron_expression)) return;

    const task = cron.schedule(schedule.cron_expression, async () => {
      try {
        const cfg = getConfig();
        const safeUrl = await validateTargetUrl(schedule.url, cfg.ALLOW_PRIVATE_NETWORKS);
        const tags = JSON.parse(schedule.tags || '[]') as string[];

        runsDal.create({
          clientId: schedule.client_id,
          projectId: schedule.project_id,
          url: safeUrl,
          browser: schedule.browser,
          connectivity: schedule.connectivity,
          iterations: schedule.iterations,
          mobile: schedule.mobile === 1,
          tags: [...new Set([...tags, 'scheduled'])],
        });

        schedulesDal.markTriggered(schedule.id);
        runQueueService.trigger();
      } catch (err) {
        console.error(`[Scheduler] Failed to trigger schedule #${schedule.id}:`, err);
      }
    });

    this.tasks.set(schedule.id, task);
  }

  public unregisterSchedule(scheduleId: number): void {
    const existing = this.tasks.get(scheduleId);
    if (existing) {
      existing.stop();
      this.tasks.delete(scheduleId);
    }
  }
}

export const schedulerService = new SchedulerService();

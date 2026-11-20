import { getDb } from '../db/database.js';
import type { BrowserType, ConnectivityType, ScheduleRecord } from '../db/types.js';

export interface CreateScheduleInput {
  clientId: number;
  projectId?: number | null;
  name: string;
  url: string;
  cronExpression: string;
  browser: BrowserType;
  connectivity: ConnectivityType;
  iterations: number;
  mobile: boolean;
  tags: string[];
  enabled?: boolean;
}

export const schedulesDal = {
  list(clientId?: number): ScheduleRecord[] {
    if (clientId !== undefined) {
      return getDb()
        .prepare('SELECT * FROM schedules WHERE client_id = ? ORDER BY id DESC')
        .all(clientId) as unknown as ScheduleRecord[];
    }
    return getDb().prepare('SELECT * FROM schedules ORDER BY id DESC').all() as unknown as ScheduleRecord[];
  },

  listEnabled(): ScheduleRecord[] {
    return getDb()
      .prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY id ASC')
      .all() as unknown as ScheduleRecord[];
  },

  getById(id: number): ScheduleRecord | undefined {
    return getDb().prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRecord | undefined;
  },

  create(input: CreateScheduleInput): ScheduleRecord {
    const stmt = getDb().prepare(`
      INSERT INTO schedules (
        client_id, project_id, name, url, cron_expression,
        browser, connectivity, iterations, mobile, tags, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      input.clientId,
      input.projectId ?? null,
      input.name,
      input.url,
      input.cronExpression,
      input.browser,
      input.connectivity,
      input.iterations,
      input.mobile ? 1 : 0,
      JSON.stringify(input.tags),
      input.enabled === false ? 0 : 1
    );
    return this.getById(Number(info.lastInsertRowid))!;
  },

  setEnabled(id: number, enabled: boolean): ScheduleRecord | undefined {
    getDb().prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    return this.getById(id);
  },

  markTriggered(id: number): void {
    getDb().prepare("UPDATE schedules SET last_run_at = datetime('now') WHERE id = ?").run(id);
  },

  delete(id: number): boolean {
    const info = getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return info.changes > 0;
  },
};

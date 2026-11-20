import type { SQLInputValue } from 'node:sqlite';
import { getDb } from '../db/database.js';
import type {
  BrowserType,
  ConnectivityType,
  RunMetricsRecord,
  RunStatus,
  TestRunRecord,
} from '../db/types.js';

export interface CreateRunInput {
  clientId: number;
  projectId?: number | null;
  url: string;
  browser: BrowserType;
  connectivity: ConnectivityType;
  iterations: number;
  mobile: boolean;
  tags: string[];
}

export interface RunFilterQuery {
  clientId?: number;
  projectId?: number;
  status?: RunStatus;
  tag?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface RunWithMetrics extends TestRunRecord {
  client_name: string;
  project_name: string | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  ttfb_ms: number | null;
  speed_index_ms: number | null;
  fully_loaded_ms: number | null;
  page_size_bytes: number | null;
  requests_count: number | null;
  coach_score: number | null;
  video_rel_path: string | null;
  har_rel_path: string | null;
}

export interface UpsertMetricsInput {
  runId: number;
  url: string;
  fcpMs?: number | null;
  lcpMs?: number | null;
  cls?: number | null;
  tbtMs?: number | null;
  ttfbMs?: number | null;
  speedIndexMs?: number | null;
  fullyLoadedMs?: number | null;
  pageSizeBytes?: number | null;
  requestsCount?: number | null;
  coachScore?: number | null;
  videoRelPath?: string | null;
  harRelPath?: string | null;
}

export const runsDal = {
  create(input: CreateRunInput): TestRunRecord {
    const stmt = getDb().prepare(`
      INSERT INTO test_runs (client_id, project_id, url, browser, connectivity, iterations, mobile, tags, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')
    `);
    const info = stmt.run(
      input.clientId,
      input.projectId ?? null,
      input.url,
      input.browser,
      input.connectivity,
      input.iterations,
      input.mobile ? 1 : 0,
      JSON.stringify(input.tags)
    );
    return this.getById(Number(info.lastInsertRowid))!;
  },

  getById(id: number): TestRunRecord | undefined {
    return getDb().prepare('SELECT * FROM test_runs WHERE id = ?').get(id) as TestRunRecord | undefined;
  },

  getWithMetricsById(id: number): RunWithMetrics | undefined {
    return getDb()
      .prepare(`
        SELECT r.*, c.name AS client_name, p.name AS project_name,
               m.fcp_ms, m.lcp_ms, m.cls, m.tbt_ms, m.ttfb_ms,
               m.speed_index_ms, m.fully_loaded_ms, m.page_size_bytes,
               m.requests_count, m.coach_score, m.video_rel_path, m.har_rel_path
        FROM test_runs r
        JOIN clients c ON c.id = r.client_id
        LEFT JOIN projects p ON p.id = r.project_id
        LEFT JOIN run_metrics m ON m.run_id = r.id
        WHERE r.id = ?
      `)
      .get(id) as RunWithMetrics | undefined;
  },

  list(filter: RunFilterQuery = {}): RunWithMetrics[] {
    const conditions: string[] = [];
    const params: SQLInputValue[] = [];

    if (filter.clientId !== undefined) {
      conditions.push('r.client_id = ?');
      params.push(filter.clientId);
    }
    if (filter.projectId !== undefined) {
      conditions.push('r.project_id = ?');
      params.push(filter.projectId);
    }
    if (filter.status) {
      conditions.push('r.status = ?');
      params.push(filter.status);
    }
    if (filter.tag) {
      // Exact JSON string element match using LIKE on serialized array with quotes
      conditions.push('r.tags LIKE ?');
      params.push(`%"${filter.tag.replace(/[%_"]/g, '')}"%`);
    }
    if (filter.search) {
      conditions.push('(r.url LIKE ? OR c.name LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }
    if (filter.fromDate) {
      conditions.push('r.created_at >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('r.created_at <= ?');
      params.push(filter.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    params.push(limit);

    return getDb()
      .prepare(`
        SELECT r.*, c.name AS client_name, p.name AS project_name,
               m.fcp_ms, m.lcp_ms, m.cls, m.tbt_ms, m.ttfb_ms,
               m.speed_index_ms, m.fully_loaded_ms, m.page_size_bytes,
               m.requests_count, m.coach_score, m.video_rel_path, m.har_rel_path
        FROM test_runs r
        JOIN clients c ON c.id = r.client_id
        LEFT JOIN projects p ON p.id = r.project_id
        LEFT JOIN run_metrics m ON m.run_id = r.id
        ${whereClause}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ?
      `)
      .all(...params) as unknown as RunWithMetrics[];
  },

  listQueued(limit = 10): TestRunRecord[] {
    return getDb()
      .prepare("SELECT * FROM test_runs WHERE status = 'queued' ORDER BY id ASC LIMIT ?")
      .all(limit) as unknown as TestRunRecord[];
  },

  markRunning(id: number, containerId: string | null, reportDir: string): void {
    getDb()
      .prepare(
        "UPDATE test_runs SET status = 'running', container_id = ?, report_dir = ?, started_at = datetime('now') WHERE id = ?"
      )
      .run(containerId, reportDir, id);
  },

  updateContainerId(id: number, containerId: string): void {
    getDb().prepare('UPDATE test_runs SET container_id = ? WHERE id = ?').run(containerId, id);
  },

  markCompleted(id: number): void {
    getDb()
      .prepare("UPDATE test_runs SET status = 'completed', finished_at = datetime('now') WHERE id = ?")
      .run(id);
  },

  markFailed(id: number, errorMessage: string): void {
    getDb()
      .prepare(
        "UPDATE test_runs SET status = 'failed', error_message = ?, finished_at = datetime('now') WHERE id = ?"
      )
      .run(errorMessage.slice(0, 2000), id);
  },

  markCancelled(id: number): void {
    getDb()
      .prepare(
        "UPDATE test_runs SET status = 'cancelled', finished_at = datetime('now') WHERE id = ?"
      )
      .run(id);
  },

  upsertMetrics(input: UpsertMetricsInput): RunMetricsRecord {
    getDb()
      .prepare(`
        INSERT INTO run_metrics (
          run_id, url, fcp_ms, lcp_ms, cls, tbt_ms, ttfb_ms,
          speed_index_ms, fully_loaded_ms, page_size_bytes,
          requests_count, coach_score, video_rel_path, har_rel_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          fcp_ms = excluded.fcp_ms,
          lcp_ms = excluded.lcp_ms,
          cls = excluded.cls,
          tbt_ms = excluded.tbt_ms,
          ttfb_ms = excluded.ttfb_ms,
          speed_index_ms = excluded.speed_index_ms,
          fully_loaded_ms = excluded.fully_loaded_ms,
          page_size_bytes = excluded.page_size_bytes,
          requests_count = excluded.requests_count,
          coach_score = excluded.coach_score,
          video_rel_path = excluded.video_rel_path,
          har_rel_path = excluded.har_rel_path
      `)
      .run(
        input.runId,
        input.url,
        input.fcpMs ?? null,
        input.lcpMs ?? null,
        input.cls ?? null,
        input.tbtMs ?? null,
        input.ttfbMs ?? null,
        input.speedIndexMs ?? null,
        input.fullyLoadedMs ?? null,
        input.pageSizeBytes ?? null,
        input.requestsCount ?? null,
        input.coachScore ?? null,
        input.videoRelPath ?? null,
        input.harRelPath ?? null
      );

    return getDb()
      .prepare('SELECT * FROM run_metrics WHERE run_id = ?')
      .get(input.runId) as unknown as RunMetricsRecord;
  },

  delete(id: number): boolean {
    const info = getDb().prepare('DELETE FROM test_runs WHERE id = ?').run(id);
    return info.changes > 0;
  },
};

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let dbInstance: DatabaseSync | null = null;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    contact_email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    default_tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    project_id INTEGER,
    url TEXT NOT NULL,
    browser TEXT NOT NULL DEFAULT 'chrome',
    connectivity TEXT NOT NULL DEFAULT 'cable',
    iterations INTEGER NOT NULL DEFAULT 3,
    mobile INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'queued',
    container_id TEXT,
    report_dir TEXT,
    error_message TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS run_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL UNIQUE,
    url TEXT NOT NULL,
    fcp_ms REAL,
    lcp_ms REAL,
    cls REAL,
    tbt_ms REAL,
    ttfb_ms REAL,
    speed_index_ms REAL,
    fully_loaded_ms REAL,
    page_size_bytes INTEGER,
    requests_count INTEGER,
    coach_score REAL,
    video_rel_path TEXT,
    har_rel_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    project_id INTEGER,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    browser TEXT NOT NULL DEFAULT 'chrome',
    connectivity TEXT NOT NULL DEFAULT 'cable',
    iterations INTEGER NOT NULL DEFAULT 3,
    mobile INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS shared_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '{}',
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_runs_client_created ON test_runs(client_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON test_runs(status);
  CREATE INDEX IF NOT EXISTS idx_metrics_run_id ON run_metrics(run_id);
  CREATE INDEX IF NOT EXISTS idx_shared_token ON shared_reports(token);
`;

/**
 * Initializes the SQLite database, ensures parent directory exists, and runs schema migrations.
 */
export function initDatabase(dbPath: string): DatabaseSync {
  if (dbInstance) return dbInstance;
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  dbInstance = db;
  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function checkDatabaseHealth(): boolean {
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}

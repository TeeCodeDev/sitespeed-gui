import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import type { SharedReportRecord } from '../db/types.js';

export interface CreateSharedReportInput {
  clientId: number;
  title: string;
  filters: Record<string, unknown>;
  expiresAt?: string | null;
}

export const sharedReportsDal = {
  create(input: CreateSharedReportInput): SharedReportRecord {
    const token = crypto.randomBytes(24).toString('base64url');
    const stmt = getDb().prepare(`
      INSERT INTO shared_reports (token, client_id, title, filters_json, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      token,
      input.clientId,
      input.title,
      JSON.stringify(input.filters),
      input.expiresAt ?? null
    );
    return getDb()
      .prepare('SELECT * FROM shared_reports WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as unknown as SharedReportRecord;
  },

  getByToken(token: string): SharedReportRecord | undefined {
    return getDb()
      .prepare('SELECT * FROM shared_reports WHERE token = ?')
      .get(token) as SharedReportRecord | undefined;
  },

  listByClient(clientId: number): SharedReportRecord[] {
    return getDb()
      .prepare('SELECT * FROM shared_reports WHERE client_id = ? ORDER BY created_at DESC')
      .all(clientId) as unknown as SharedReportRecord[];
  },

  delete(id: number): boolean {
    const info = getDb().prepare('DELETE FROM shared_reports WHERE id = ?').run(id);
    return info.changes > 0;
  },
};

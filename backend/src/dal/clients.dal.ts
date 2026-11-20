import { getDb } from '../db/database.js';
import type { ClientRecord, ProjectRecord } from '../db/types.js';

export interface CreateClientInput {
  name: string;
  slug: string;
  contactEmail?: string | null;
  notes?: string | null;
}

export interface CreateProjectInput {
  clientId: number;
  name: string;
  baseUrl: string;
  defaultTags?: string[];
}

export const clientsDal = {
  list(): ClientRecord[] {
    return getDb().prepare('SELECT * FROM clients ORDER BY name ASC').all() as unknown as ClientRecord[];
  },

  getById(id: number): ClientRecord | undefined {
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRecord | undefined;
  },

  create(input: CreateClientInput): ClientRecord {
    const stmt = getDb().prepare(
      'INSERT INTO clients (name, slug, contact_email, notes) VALUES (?, ?, ?, ?)'
    );
    const info = stmt.run(input.name, input.slug, input.contactEmail ?? null, input.notes ?? null);
    return this.getById(Number(info.lastInsertRowid))!;
  },

  update(id: number, input: Partial<CreateClientInput>): ClientRecord | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const stmt = getDb().prepare(
      'UPDATE clients SET name = ?, slug = ?, contact_email = ?, notes = ? WHERE id = ?'
    );
    stmt.run(
      input.name ?? existing.name,
      input.slug ?? existing.slug,
      input.contactEmail !== undefined ? input.contactEmail : existing.contact_email,
      input.notes !== undefined ? input.notes : existing.notes,
      id
    );
    return this.getById(id);
  },

  delete(id: number): boolean {
    const info = getDb().prepare('DELETE FROM clients WHERE id = ?').run(id);
    return info.changes > 0;
  },

  listProjects(clientId?: number): ProjectRecord[] {
    if (clientId !== undefined) {
      return getDb()
        .prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY name ASC')
        .all(clientId) as unknown as ProjectRecord[];
    }
    return getDb().prepare('SELECT * FROM projects ORDER BY name ASC').all() as unknown as ProjectRecord[];
  },

  getProjectById(id: number): ProjectRecord | undefined {
    return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRecord | undefined;
  },

  createProject(input: CreateProjectInput): ProjectRecord {
    const stmt = getDb().prepare(
      'INSERT INTO projects (client_id, name, base_url, default_tags) VALUES (?, ?, ?, ?)'
    );
    const info = stmt.run(
      input.clientId,
      input.name,
      input.baseUrl,
      JSON.stringify(input.defaultTags ?? [])
    );
    return this.getProjectById(Number(info.lastInsertRowid))!;
  },

  deleteProject(id: number): boolean {
    const info = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
    return info.changes > 0;
  },
};

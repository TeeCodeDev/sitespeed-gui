import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../config/env.js';
import { clientsDal } from '../dal/clients.dal.js';
import { validateTargetUrl } from '../services/urlGuard.service.js';

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .optional(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  defaultTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'client';
}

export async function registerClientRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/clients', async () => {
    return { clients: clientsDal.list() };
  });

  app.post('/api/clients', async (req, reply) => {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid client data' });
    }
    const slug = parsed.data.slug ?? toSlug(parsed.data.name);
    try {
      const client = clientsDal.create({ ...parsed.data, slug });
      return reply.code(201).send({ client });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client';
      return reply.code(409).send({ error: message });
    }
  });

  app.delete('/api/clients/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid client ID' });
    }
    const deleted = clientsDal.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Client not found' });
    return { ok: true };
  });

  app.get('/api/projects', async (req) => {
    const query = req.query as { clientId?: string };
    const clientId = query.clientId ? Number(query.clientId) : undefined;
    return { projects: clientsDal.listProjects(Number.isInteger(clientId) ? clientId : undefined) };
  });

  app.post('/api/clients/:id/projects', async (req, reply) => {
    const clientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({ error: 'Invalid client ID' });
    }
    if (!clientsDal.getById(clientId)) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid project data' });
    }

    try {
      const cfg = getConfig();
      const safeUrl = await validateTargetUrl(parsed.data.baseUrl, cfg.ALLOW_PRIVATE_NETWORKS);
      const project = clientsDal.createProject({
        clientId,
        name: parsed.data.name,
        baseUrl: safeUrl,
        defaultTags: parsed.data.defaultTags,
      });
      return reply.code(201).send({ project });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid project URL';
      return reply.code(400).send({ error: message });
    }
  });

  app.delete('/api/projects/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid project ID' });
    }
    const deleted = clientsDal.deleteProject(id);
    if (!deleted) return reply.code(404).send({ error: 'Project not found' });
    return { ok: true };
  });
}

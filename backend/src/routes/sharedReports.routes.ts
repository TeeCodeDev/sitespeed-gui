import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clientsDal } from '../dal/clients.dal.js';
import { runsDal } from '../dal/runs.dal.js';
import { sharedReportsDal } from '../dal/sharedReports.dal.js';

const createShareSchema = z.object({
  clientId: z.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  filters: z
    .object({
      projectId: z.number().int().positive().optional(),
      tag: z.string().max(40).optional(),
      fromDate: z.string().max(40).optional(),
      toDate: z.string().max(40).optional(),
    })
    .default({}),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function registerSharedReportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/shares', async (req, reply) => {
    const clientId = Number((req.query as { clientId?: string }).clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({ error: 'clientId query parameter is required' });
    }
    return { shares: sharedReportsDal.listByClient(clientId) };
  });

  app.post('/api/shares', async (req, reply) => {
    const parsed = createShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid share payload' });
    }
    if (!clientsDal.getById(parsed.data.clientId)) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
      : null;

    const share = sharedReportsDal.create({
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      filters: parsed.data.filters,
      expiresAt,
    });
    return reply.code(201).send({ share });
  });

  app.delete('/api/shares/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid share ID' });
    }
    const deleted = sharedReportsDal.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Share link not found' });
    return { ok: true };
  });

  // Public read-only endpoint for shared client reports
  app.get('/api/shared/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
      return reply.code(400).send({ error: 'Invalid share token' });
    }

    const share = sharedReportsDal.getByToken(token);
    if (!share) return reply.code(404).send({ error: 'Shared report not found' });

    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return reply.code(410).send({ error: 'Shared report link has expired' });
    }

    const client = clientsDal.getById(share.client_id);
    if (!client) return reply.code(404).send({ error: 'Client not found' });

    const filters = JSON.parse(share.filters_json || '{}') as {
      projectId?: number;
      tag?: string;
      fromDate?: string;
      toDate?: string;
    };

    const runs = runsDal.list({
      clientId: share.client_id,
      projectId: filters.projectId,
      tag: filters.tag,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      status: 'completed',
      limit: 200,
    });

    return {
      report: {
        title: share.title,
        clientName: client.name,
        createdAt: share.created_at,
        expiresAt: share.expires_at,
        runs,
      },
    };
  });
}

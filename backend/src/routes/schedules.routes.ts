import type { FastifyInstance } from 'fastify';
import cron from 'node-cron';
import { z } from 'zod';
import { getConfig } from '../config/env.js';
import { clientsDal } from '../dal/clients.dal.js';
import { schedulesDal } from '../dal/schedules.dal.js';
import { schedulerService } from '../services/scheduler.service.js';
import { validateTargetUrl } from '../services/urlGuard.service.js';

const createScheduleSchema = z.object({
  clientId: z.number().int().positive(),
  projectId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(1000),
  cronExpression: z.string().trim().min(5).max(80),
  browser: z.enum(['chrome', 'firefox']).default('chrome'),
  connectivity: z.enum(['native', 'cable', '4g', '3g']).default('cable'),
  iterations: z.number().int().min(1).max(10).default(3),
  mobile: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export async function registerScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/schedules', async (req) => {
    const query = req.query as { clientId?: string };
    const clientId = query.clientId ? Number(query.clientId) : undefined;
    return { schedules: schedulesDal.list(Number.isInteger(clientId) ? clientId : undefined) };
  });

  app.post('/api/schedules', async (req, reply) => {
    const parsed = createScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid schedule' });
    }

    if (!cron.validate(parsed.data.cronExpression)) {
      return reply.code(400).send({ error: 'Invalid cron expression' });
    }

    if (!clientsDal.getById(parsed.data.clientId)) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    try {
      const cfg = getConfig();
      const safeUrl = await validateTargetUrl(parsed.data.url, cfg.ALLOW_PRIVATE_NETWORKS);
      const schedule = schedulesDal.create({
        ...parsed.data,
        url: safeUrl,
      });
      schedulerService.registerSchedule(schedule);
      return reply.code(201).send({ schedule });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid schedule URL';
      return reply.code(400).send({ error: message });
    }
  });

  app.patch('/api/schedules/:id/toggle', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid schedule ID' });
    }
    const existing = schedulesDal.getById(id);
    if (!existing) return reply.code(404).send({ error: 'Schedule not found' });

    const updated = schedulesDal.setEnabled(id, existing.enabled !== 1)!;
    if (updated.enabled === 1) {
      schedulerService.registerSchedule(updated);
    } else {
      schedulerService.unregisterSchedule(id);
    }
    return { schedule: updated };
  });

  app.delete('/api/schedules/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid schedule ID' });
    }
    schedulerService.unregisterSchedule(id);
    const deleted = schedulesDal.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Schedule not found' });
    return { ok: true };
  });
}

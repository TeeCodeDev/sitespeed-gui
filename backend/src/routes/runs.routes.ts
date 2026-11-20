import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../config/env.js';
import { clientsDal } from '../dal/clients.dal.js';
import { runsDal } from '../dal/runs.dal.js';
import type { RunStatus } from '../db/types.js';
import { getRunHostDir } from '../services/dockerRunner.service.js';
import { parseSitespeedResults } from '../services/metricsParser.service.js';
import { runQueueService } from '../services/queue.service.js';
import { validateTargetUrl } from '../services/urlGuard.service.js';

const createRunSchema = z.object({
  clientId: z.number().int().positive(),
  projectId: z.number().int().positive().optional().nullable(),
  url: z.string().trim().url().max(1000),
  browser: z.enum(['chrome', 'firefox']).default('chrome'),
  connectivity: z.enum(['native', 'cable', '4g', '3g']).default('cable'),
  iterations: z.number().int().min(1).max(10).default(3),
  mobile: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

const listRunsQuerySchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  tag: z.string().trim().max(40).optional(),
  search: z.string().trim().max(120).optional(),
  fromDate: z.string().trim().max(40).optional(),
  toDate: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function registerRunRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/runs', async (req, reply) => {
    const parsed = listRunsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid filter query' });
    }
    const runs = runsDal.list({
      ...parsed.data,
      status: parsed.data.status as RunStatus | undefined,
    });
    return { runs };
  });

  app.get('/api/runs/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid run ID' });
    }
    let run = runsDal.getWithMetricsById(id);
    if (!run) return reply.code(404).send({ error: 'Run not found' });

    if (
      run.status === 'completed' &&
      (!run.advice_json ||
        !run.details_json ||
        !run.details_json.includes('"allAssets"') ||
        run.lcp_ms === null)
    ) {
      const parsed = await parseSitespeedResults(run.id, run.url, getRunHostDir(run.id)).catch(
        () => null
      );
      if (parsed) {
        runsDal.upsertMetrics(parsed);
        run = runsDal.getWithMetricsById(id) ?? run;
      }
    }

    return { run };
  });

  app.get('/api/runs/:id/logs', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid run ID' });
    }
    const run = runsDal.getById(id);
    if (!run) return reply.code(404).send({ error: 'Run not found' });

    const logPath = path.join(getRunHostDir(id), 'runner.log');
    try {
      const logs = await fs.readFile(logPath, 'utf-8');
      return { logs: logs.slice(-50_000) };
    } catch {
      return { logs: '' };
    }
  });

  app.post('/api/runs', async (req, reply) => {
    const parsed = createRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid run payload' });
    }

    if (!clientsDal.getById(parsed.data.clientId)) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    try {
      const cfg = getConfig();
      const safeUrl = await validateTargetUrl(parsed.data.url, cfg.ALLOW_PRIVATE_NETWORKS);
      const run = runsDal.create({
        ...parsed.data,
        url: safeUrl,
      });
      runQueueService.trigger();
      return reply.code(201).send({ run });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'URL validation failed';
      return reply.code(400).send({ error: message });
    }
  });

  app.post('/api/runs/:id/cancel', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid run ID' });
    }
    const cancelled = await runQueueService.cancelRun(id);
    if (!cancelled) {
      return reply.code(409).send({ error: 'Run cannot be cancelled in its current state' });
    }
    return { ok: true };
  });

  app.delete('/api/runs/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid run ID' });
    }
    const run = runsDal.getById(id);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    if (run.status === 'running') {
      return reply.code(409).send({ error: 'Cancel the running test before deleting it' });
    }
    runsDal.delete(id);
    await fs.rm(getRunHostDir(id), { recursive: true, force: true }).catch(() => undefined);
    return { ok: true };
  });
}

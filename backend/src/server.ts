import fs from 'node:fs';
import path from 'node:path';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { getConfig } from './config/env.js';
import { checkDatabaseHealth, closeDatabase, initDatabase } from './db/database.js';
import { basicAuthHook } from './routes/auth.hook.js';
import { registerClientRoutes } from './routes/clients.routes.js';
import { registerRunRoutes } from './routes/runs.routes.js';
import { registerScheduleRoutes } from './routes/schedules.routes.js';
import { registerSharedReportRoutes } from './routes/sharedReports.routes.js';
import { checkDockerHealth } from './services/dockerRunner.service.js';
import { runQueueService } from './services/queue.service.js';
import { schedulerService } from './services/scheduler.service.js';

export async function buildApp() {
  const cfg = getConfig();
  fs.mkdirSync(cfg.RESULTS_DIR, { recursive: true });
  initDatabase(cfg.DB_PATH);

  const app = Fastify({
    logger: { level: cfg.LOG_LEVEL },
  });

  await app.register(cors, {
    origin: cfg.CORS_ORIGIN === '*' ? true : cfg.CORS_ORIGIN.split(','),
  });

  app.addHook('onRequest', basicAuthHook);

  // Health check endpoint verifying both SQLite and Docker daemon connectivity
  app.get('/healthz', async (_req, reply) => {
    const dbOk = checkDatabaseHealth();
    const dockerOk = await checkDockerHealth();
    const status = dbOk && dockerOk ? 'ok' : 'degraded';
    return reply.code(dbOk ? 200 : 503).send({
      status,
      database: dbOk ? 'up' : 'down',
      docker: dockerOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  await registerClientRoutes(app);
  await registerRunRoutes(app);
  await registerScheduleRoutes(app);
  await registerSharedReportRoutes(app);

  // Serve Sitespeed.io generated HTML reports & Browsertime videos safely under /reports/
  await app.register(fastifyStatic, {
    root: path.resolve(cfg.RESULTS_DIR),
    prefix: '/reports/',
    decorateReply: false,
    index: ['index.html'],
  });

  // Serve built React frontend in production if present
  const frontendDist = cfg.FRONTEND_DIST_DIR ?? path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/reports/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

async function main() {
  const cfg = getConfig();
  const app = await buildApp();

  schedulerService.startAll();
  runQueueService.trigger();

  const shutdown = async () => {
    schedulerService.stopAll();
    await app.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: cfg.PORT, host: cfg.HOST });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

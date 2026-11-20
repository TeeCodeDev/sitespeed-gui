import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DB_PATH: z.string().min(1).default(path.resolve(process.cwd(), 'data/db/sitespeed.sqlite')),
  RESULTS_DIR: z.string().min(1).default(path.resolve(process.cwd(), 'data/results')),
  FRONTEND_DIST_DIR: z.string().optional(),

  DOCKER_SOCKET_PATH: z.string().min(1).default('/var/run/docker.sock'),
  RESULTS_VOLUME_NAME: z.string().min(1).default('sitespeed_results'),
  SITESPEED_IMAGE: z.string().regex(/^[a-z0-9./_-]+:[a-zA-Z0-9._-]+$/, 'Invalid Docker image tag').default('sitespeedio/sitespeed.io:36.4.0'),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).max(10).default(1),
  RUN_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(1_800_000).default(300_000),
  CONTAINER_MEMORY_MB: z.coerce.number().int().min(512).max(16384).default(2048),
  CONTAINER_SHM_MB: z.coerce.number().int().min(256).max(8192).default(1024),
  CONTAINER_CPU_CORES: z.coerce.number().min(0.5).max(16).default(2),

  ALLOW_PRIVATE_NETWORKS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  AUTH_USERNAME: z.string().optional().default(''),
  AUTH_PASSWORD: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('*'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

/**
 * Parses and validates environment variables once at startup.
 */
export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cachedConfig = parsed.data;
  return cachedConfig;
}

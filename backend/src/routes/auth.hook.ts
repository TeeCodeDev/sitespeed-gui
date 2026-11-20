import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getConfig } from '../config/env.js';

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Optional Basic Auth guard for internal LAN/VPN deployments.
 * Public health checks and tokenized shared client reports bypass this guard.
 */
export async function basicAuthHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const cfg = getConfig();
  if (!cfg.AUTH_USERNAME || !cfg.AUTH_PASSWORD) return;

  const urlPath = req.url.split('?')[0];
  if (urlPath === '/healthz' || urlPath.startsWith('/api/shared/')) {
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="SiteSpeed GUI"');
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) {
    reply.header('WWW-Authenticate', 'Basic realm="SiteSpeed GUI"');
    return reply.code(401).send({ error: 'Invalid credentials' });
  }

  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  if (!timingSafeEquals(user, cfg.AUTH_USERNAME) || !timingSafeEquals(pass, cfg.AUTH_PASSWORD)) {
    reply.header('WWW-Authenticate', 'Basic realm="SiteSpeed GUI"');
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
}

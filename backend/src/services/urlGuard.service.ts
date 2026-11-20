import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Checks whether an IPv4 or IPv6 address belongs to a private, loopback, or link-local range.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe80:')) return true; // Link-local fe80::/10
    // IPv4-mapped IPv6 ::ffff:127.0.0.1
    const v4Match = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Match) return isPrivateOrReservedIp(v4Match[1]);
    return false;
  }

  return true;
}

/**
 * Validates that a target URL uses http/https and, unless allowPrivateNetworks is true,
 * does not resolve to a private, loopback, or metadata IP address.
 */
export async function validateTargetUrl(
  rawUrl: string,
  allowPrivateNetworks: boolean
): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new Error('URL hostname is required');
  }

  if (!allowPrivateNetworks) {
    if (hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.local')) {
      throw new Error('Private/local hostnames are blocked by security policy');
    }

    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        throw new Error('Private or reserved IP addresses are blocked by security policy');
      }
    } else {
      try {
        const records = await dns.lookup(hostname, { all: true });
        if (records.length === 0) {
          throw new Error('Hostname could not be resolved');
        }
        for (const rec of records) {
          if (isPrivateOrReservedIp(rec.address)) {
            throw new Error('Target hostname resolves to a private or reserved IP address');
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('blocked')) {
          throw err;
        }
        throw new Error(`DNS resolution failed for ${hostname}`);
      }
    }
  }

  return parsed.toString();
}

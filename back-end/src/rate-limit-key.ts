import { createHash } from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

type RateLimitRequest = Pick<Request, 'headers' | 'ip'> & {
  socket: Pick<Request['socket'], 'remoteAddress'>;
};

export function rateLimitKey(request: RateLimitRequest): string {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return `token:${tokenHash}`;
  }

  const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  return `ip:${ipKeyGenerator(ip)}`;
}

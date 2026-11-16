import { rateLimitKey } from './rate-limit-key';

function request(ip: string, authorization?: string): Parameters<typeof rateLimitKey>[0] {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: authorization ? { authorization } : {},
  };
}

describe('rateLimitKey', () => {
  it('is stable for the same authenticated session', () => {
    expect(rateLimitKey(request('203.0.113.1', 'Bearer session-token')))
      .toBe(rateLimitKey(request('203.0.113.2', 'Bearer session-token')));
  });

  it('isolates authenticated sessions sharing an IP', () => {
    expect(rateLimitKey(request('203.0.113.1', 'Bearer first-token')))
      .not.toBe(rateLimitKey(request('203.0.113.1', 'Bearer second-token')));
  });

  it('uses the client IP for unauthenticated requests', () => {
    expect(rateLimitKey(request('203.0.113.1'))).toBe('ip:203.0.113.1');
  });
});

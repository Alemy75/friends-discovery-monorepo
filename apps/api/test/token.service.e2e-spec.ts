import { startRedis, StartedRedis } from './testcontainers';
import Redis from 'ioredis';
import { TokenService } from '../src/auth/token.service';
import { Role } from '@friends-ai/contracts';

function makeConfig(_redisUrl: string) {
  return {
    jwtSecret: 'x'.repeat(32),
    accessTtl: 900,
    refreshTtl: 3600,
  } as any;
}

describe('TokenService (integration)', () => {
  let redis: StartedRedis;
  let client: Redis;
  let svc: TokenService;

  beforeAll(async () => {
    redis = await startRedis();
    client = new Redis(redis.url);
    svc = new TokenService(makeConfig(redis.url), { client } as any);
  }, 120000);

  afterAll(async () => {
    await client?.quit();
    await redis?.stop();
  });

  it('signs and verifies an access token', () => {
    const t = svc.signAccess('u1', Role.User);
    expect(svc.verifyAccess(t)).toMatchObject({ sub: 'u1', role: Role.User });
  });

  it('rotates a refresh session and issues a new token', async () => {
    const { refreshToken } = await svc.issueSession('u1');
    const rotated = await svc.rotate(refreshToken);
    expect(rotated.userId).toBe('u1');
    expect(rotated.refreshToken).not.toBe(refreshToken);
  });

  it('detects reuse: the old token is rejected after rotation and kills the session', async () => {
    const { refreshToken } = await svc.issueSession('u2');
    const rotated = await svc.rotate(refreshToken);
    await expect(svc.rotate(refreshToken)).rejects.toThrow(); // reuse of old token
    await expect(svc.rotate(rotated.refreshToken)).rejects.toThrow(); // session was killed
  });
});

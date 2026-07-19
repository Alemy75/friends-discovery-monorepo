import { startRedis, StartedRedis } from './testcontainers';
import Redis from 'ioredis';
import { VerificationService } from '../src/auth/verification.service';

describe('VerificationService (integration)', () => {
  let redis: StartedRedis;
  let client: Redis;
  let sent: { to: string; subject: string; text: string }[];
  let svc: VerificationService;

  beforeAll(async () => {
    redis = await startRedis();
    client = new Redis(redis.url);
    sent = [];
    const mailer = { send: async (m: any) => { sent.push(m); } };
    const config = { appUrl: 'http://localhost:5173', mailFrom: 'x@y.z' } as any;
    svc = new VerificationService({ client } as any, mailer as any, config);
  }, 120000);

  afterAll(async () => {
    await client?.quit();
    await redis?.stop();
  });

  it('issues and confirms an email code', async () => {
    await svc.issueEmailCode('a@b.com');
    const code = (sent.at(-1)!.text.match(/\d{6}/) ?? [])[0]!;
    expect(await svc.confirmEmailCode('a@b.com', '000000')).toBe(false);
    expect(await svc.confirmEmailCode('a@b.com', code)).toBe(true);
    expect(await svc.confirmEmailCode('a@b.com', code)).toBe(false); // one-time
  });

  it('issues and consumes a reset token', async () => {
    await svc.issueResetToken('a@b.com');
    const token = (sent.at(-1)!.text.match(/token=([\w-]+)/) ?? [])[1]!;
    expect(await svc.consumeResetToken(token)).toBe('a@b.com');
    expect(await svc.consumeResetToken(token)).toBeNull(); // one-time
  });
});

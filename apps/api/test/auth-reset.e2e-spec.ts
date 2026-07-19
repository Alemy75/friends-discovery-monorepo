import { Test } from '@nestjs/testing';
import { ConsoleLogger, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';

describe('Auth password reset (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;
  let logs: string[];
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
  const agent = () => request(app.getHttpServer());

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    Object.assign(process.env, {
      DATABASE_URL: pg.url,
      REDIS_URL: redis.url,
      NODE_ENV: 'test',
      JWT_SECRET: 'x'.repeat(32),
      APP_URL: 'http://localhost:5173',
    });
    logs = [];
    // Kept live for the whole suite (restored in afterAll) so it also
    // captures the emailed reset token logged by DevMailer during the
    // `it()` blocks below, not just during app bootstrap.
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
      logs.push(String(c));
      return true;
    });
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // @nestjs/testing silences Nest's Logger by default (TestingLogger is a
    // no-op for log/warn/debug/verbose). DevMailer logs the emailed reset
    // token via Logger, so restore a real ConsoleLogger here — it writes
    // through process.stdout.write, which the spy above captures.
    app.useLogger(new ConsoleLogger());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => {
    stdoutSpy?.mockRestore();
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('resets the password and lets the user log in with the new one', async () => {
    await agent().post('/api/v1/auth/register').send({ email: 'r@b.com', password: 'password123' }).expect(201);
    logs.length = 0;
    await agent().post('/api/v1/auth/password/reset-request').send({ email: 'r@b.com' }).expect(204);
    const token = (logs.join('').match(/token=([\w-]+)/) ?? [])[1];
    expect(token).toBeTruthy();

    await agent().post('/api/v1/auth/password/reset').send({ token, password: 'newpassword456' }).expect(204);
    await agent().post('/api/v1/auth/login').send({ email: 'r@b.com', password: 'password123' }).expect(401);
    await agent().post('/api/v1/auth/login').send({ email: 'r@b.com', password: 'newpassword456' }).expect(200);
  });

  it('reset-request for unknown email still returns 204 (no enumeration)', async () => {
    await agent().post('/api/v1/auth/password/reset-request').send({ email: 'nobody@b.com' }).expect(204);
  });
});

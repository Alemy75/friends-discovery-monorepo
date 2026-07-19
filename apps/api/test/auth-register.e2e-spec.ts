import { Test } from '@nestjs/testing';
import { ConsoleLogger, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';

describe('Auth register/verify (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;
  let logs: string[];
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.APP_URL = 'http://localhost:5173';
    logs = [];
    // Kept live for the whole suite (restored in afterAll) so it also
    // captures the emailed code logged by DevMailer during the `it()`
    // blocks below, not just during app bootstrap.
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((c: any) => { logs.push(String(c)); return true; });
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // @nestjs/testing silences Nest's Logger by default (TestingLogger is a
    // no-op for log/warn/debug/verbose). DevMailer logs the emailed code via
    // Logger, so restore a real ConsoleLogger here — it writes through
    // process.stdout.write, which the spy above captures.
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

  it('registers, rejects duplicate, then verifies with the emailed code', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: 'password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: 'password123' })
      .expect(409);

    const code = (logs.join('').match(/код подтверждения: (\d{6})/) ?? [])[1];
    expect(code).toMatch(/^\d{6}$/);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email: 'a@b.com', code })
      .expect(204);
  });

  it('rejects invalid registration payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });
});

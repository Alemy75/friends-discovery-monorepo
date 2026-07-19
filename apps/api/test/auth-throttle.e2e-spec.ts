import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';

describe('Auth throttle (e2e)', () => {
  let pg: StartedPostgres; let redis: StartedRedis; let app: INestApplication;

  const agent = () => request(app.getHttpServer());

  beforeAll(async () => {
    pg = await startPostgres(); redis = await startRedis();
    Object.assign(process.env, {
      DATABASE_URL: pg.url, REDIS_URL: redis.url, NODE_ENV: 'test',
      JWT_SECRET: 'x'.repeat(32), APP_URL: 'http://localhost:5173',
    });
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => { await app?.close(); await redis?.stop(); await pg?.stop(); });

  it('rate-limits repeated login attempts', async () => {
    let sawLimit = false;
    for (let i = 0; i < 30; i++) {
      const res = await agent().post('/api/v1/auth/login').send({ email: 'x@y.z', password: 'nope' });
      if (res.status === 429) { sawLimit = true; break; }
    }
    expect(sawLimit).toBe(true);
  });
});

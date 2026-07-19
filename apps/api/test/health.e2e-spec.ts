import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';
import type { AppModule as AppModuleType } from '../src/app.module';

describe('Health (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    // AppConfigModule validates process.env eagerly at import time (see
    // prisma.e2e-spec.ts), so AppModule must be imported *after* the env vars
    // above are set — otherwise it binds to a stale/missing DATABASE_URL /
    // REDIS_URL instead of the Testcontainers connection strings.
    const { AppModule }: { AppModule: typeof AppModuleType } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('GET /health reports database and redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
  });

  it('applies the /api/v1 prefix to normal routes (health is excluded)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(404);
  });
});

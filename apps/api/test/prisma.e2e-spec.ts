import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';
import type { AppModule as AppModuleType } from '../src/app.module';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

describe('Prisma (integration)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;
  let prisma: PrismaServiceType;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    process.env.DATABASE_URL = pg.url;
    // AppModule now wires in the global RedisModule (Task 5), so a live,
    // reachable Redis is required here too — a fake/unreachable REDIS_URL
    // leaves the ioredis client reconnecting after the test ends, delaying
    // Jest's exit.
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.APP_URL = 'http://localhost:5173';
    // AppConfigModule validates process.env eagerly at import time (inside
    // ConfigModule.forRoot()), so AppModule must be imported *after* the env
    // vars above are set — otherwise it binds to a stale/missing DATABASE_URL
    // instead of the Testcontainers connection string.
    const { AppModule }: { AppModule: typeof AppModuleType } = await import('../src/app.module');
    const { PrismaService }: { PrismaService: typeof PrismaServiceType } = await import(
      '../src/prisma/prisma.service'
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('round-trips a City row', async () => {
    const created = await prisma.city.create({
      data: { slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845 },
    });
    const found = await prisma.city.findUnique({ where: { slug: 'yaroslavl' } });
    expect(found?.id).toBe(created.id);
    expect(found?.isActive).toBe(true);
  });
});

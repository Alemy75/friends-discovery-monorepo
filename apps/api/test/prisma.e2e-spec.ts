import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { startPostgres, StartedPostgres } from './testcontainers';
import type { AppModule as AppModuleType } from '../src/app.module';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

describe('Prisma (integration)', () => {
  let pg: StartedPostgres;
  let app: INestApplication;
  let prisma: PrismaServiceType;

  beforeAll(async () => {
    pg = await startPostgres();
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NODE_ENV = 'test';
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

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { startPostgres, startRedis, seedTestDatabase, StartedPostgres, StartedRedis } from './testcontainers';

describe('Catalog (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    seedTestDatabase(pg.url);
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.APP_URL = 'http://localhost:5173';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('GET /cities returns seeded Yaroslavl (public, no auth)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/cities').expect(200);
    expect(res.body.some((c: any) => c.slug === 'yaroslavl')).toBe(true);
    expect(res.body[0]).not.toHaveProperty('centerLat');
  });

  it('GET /interests returns 20 seeded interests (public)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/interests').expect(200);
    expect(res.body).toHaveLength(20);
    expect(res.body[0]).toEqual(expect.objectContaining({ slug: expect.any(String), label: expect.any(String) }));
  });
});

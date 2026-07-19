import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';

describe('Auth RBAC / me (e2e)', () => {
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
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => { await app?.close(); await redis?.stop(); await pg?.stop(); });

  it('rejects /me without a token and returns the user with one', async () => {
    await agent().get('/api/v1/auth/me').expect(401);
    await agent().post('/api/v1/auth/register').send({ email: 'me@b.com', password: 'password123' }).expect(201);
    const login = await agent().post('/api/v1/auth/login').send({ email: 'me@b.com', password: 'password123' }).expect(200);
    const me = await agent().get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(me.body).toMatchObject({ email: 'me@b.com', role: 'user', status: 'active', emailVerified: false });
  });
});

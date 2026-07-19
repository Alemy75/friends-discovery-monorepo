import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth login/refresh (e2e)', () => {
  let pg: StartedPostgres; let redis: StartedRedis; let app: INestApplication;

  const agent = () => request(app.getHttpServer());
  const register = async (email: string) =>
    agent().post('/api/v1/auth/register').send({ email, password: 'password123' }).expect(201);

  beforeAll(async () => {
    pg = await startPostgres(); redis = await startRedis();
    Object.assign(process.env, {
      DATABASE_URL: pg.url, REDIS_URL: redis.url, NODE_ENV: 'test',
      JWT_SECRET: 'x'.repeat(32), APP_URL: 'http://localhost:5173',
    });
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // `Test.createTestingModule(...).createNestApplication()` never runs main.ts's
    // `bootstrap()`, so cookie-parser (wired there in Task 7) isn't applied here
    // automatically. Without it, `req.cookies` is undefined and refresh/logout
    // always see no token. Mirror main.ts's setup so refresh cookies parse.
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => { await app?.close(); await redis?.stop(); await pg?.stop(); });

  it('logs in, returns access token + refresh cookie, rotates on refresh', async () => {
    await register('log@b.com');
    const login = await agent().post('/api/v1/auth/login').send({ email: 'log@b.com', password: 'password123' }).expect(200);
    expect(login.body.accessToken).toBeTruthy();
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toMatch(/refresh_token=/);
    expect(cookie).toMatch(/HttpOnly/i);

    const refresh = await agent().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(refresh.body.accessToken).toBeTruthy();
    expect(refresh.headers['set-cookie'][0]).not.toBe(cookie); // rotated
  });

  it('rejects bad credentials', async () => {
    await register('bad@b.com');
    await agent().post('/api/v1/auth/login').send({ email: 'bad@b.com', password: 'wrong' }).expect(401);
  });

  it('normalizes email casing between register and login', async () => {
    await agent().post('/api/v1/auth/register').send({ email: 'Mixed@Case.COM', password: 'password123' }).expect(201);
    const login = await agent()
      .post('/api/v1/auth/login')
      .send({ email: 'mixed@case.com', password: 'password123' })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
  });

  it('rejects refresh once the account is blocked, revoking the session', async () => {
    const email = 'blocked@b.com';
    await register(email);
    const login = await agent().post('/api/v1/auth/login').send({ email, password: 'password123' }).expect(200);
    const cookie = login.headers['set-cookie'][0];

    const prisma = app.get(PrismaService);
    const identity = await prisma.authIdentity.findUniqueOrThrow({
      where: { provider_identifier: { provider: 'password', identifier: email } },
    });
    await prisma.user.update({ where: { id: identity.userId }, data: { status: 'blocked' } });

    await agent().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });
});

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import { Role, AccountKind, Intent } from '@friends-ai/contracts';
import { startPostgres, startRedis, seedTestDatabase, StartedPostgres, StartedRedis } from './testcontainers';
import { TokenService } from '../src/auth/token.service';

describe('Accounts onboarding (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;
  let prisma: PrismaClient;
  let cityId: string;

  async function newUserToken(): Promise<string> {
    const user = await prisma.user.create({ data: {} });
    return app.get(TokenService).signAccess(user.id, Role.User);
  }

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
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: 'yaroslavl' } });
    cityId = city.id;
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('creates a single account and returns it via /accounts/me without leaking user id', async () => {
    const token = await newUserToken();
    const payload = {
      kind: AccountKind.Single,
      cityId,
      bio: 'Люблю кофе',
      members: [{ name: 'Аня', age: 27 }],
      interestSlugs: ['coffee', 'books'],
      intents: [Intent.Walks],
    };
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(created.body.kind).toBe('single');
    expect(created.body.members).toHaveLength(1);
    expect(created.body).not.toHaveProperty('ownerUserId');

    const me = await request(app.getHttpServer())
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.city.slug).toBe('yaroslavl');
    expect(me.body.interests.map((i: any) => i.slug).sort()).toEqual(['books', 'coffee']);
    expect(JSON.stringify(me.body)).not.toContain('ownerUserId');
  });

  it('rejects a second account for the same user with 409', async () => {
    const token = await newUserToken();
    const payload = {
      kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }],
      interestSlugs: ['coffee', 'books'], intents: [Intent.Walks],
    };
    await request(app.getHttpServer()).post('/api/v1/accounts').set('Authorization', `Bearer ${token}`).send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/v1/accounts').set('Authorization', `Bearer ${token}`).send(payload).expect(409);
  });

  it('rejects unauthenticated onboarding with 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/accounts').send({}).expect(401);
  });

  it('rejects couple with one member (400)', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Couple, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(400);
  });

  it('edits bio, interests and intents via PATCH /accounts/me', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me').set('Authorization', `Bearer ${token}`)
      .send({ bio: 'обновил', interestSlugs: ['wine', 'yoga'], intents: [Intent.Travel, Intent.Hobby] })
      .expect(200);

    expect(res.body.bio).toBe('обновил');
    expect(res.body.interests.map((i: any) => i.slug).sort()).toEqual(['wine', 'yoga']);
    expect(res.body.intents.sort()).toEqual(['hobby', 'travel']);
  });

  it('switches single -> couple then couple -> single, keeping member cardinality consistent', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);

    const toCouple = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me/kind').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Couple, secondMember: { name: 'B', age: 28 } })
      .expect(200);
    expect(toCouple.body.kind).toBe('couple');
    expect(toCouple.body.members).toHaveLength(2);
    expect(toCouple.body.members.map((m: any) => m.position)).toEqual([0, 1]);

    const toSingle = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me/kind').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single })
      .expect(200);
    expect(toSingle.body.kind).toBe('single');
    expect(toSingle.body.members).toHaveLength(1);
  });

  it('edits a member name/age via PATCH /accounts/me/members/:id', async () => {
    const token = await newUserToken();
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);
    const memberId = created.body.members[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/me/members/${memberId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Аня', age: 28 })
      .expect(200);
    expect(res.body.members[0]).toEqual(expect.objectContaining({ name: 'Аня', age: 28 }));
  });
});

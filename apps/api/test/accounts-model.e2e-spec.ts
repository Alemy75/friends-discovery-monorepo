import { PrismaClient } from '@prisma/client';
import { startPostgres, StartedPostgres } from './testcontainers';

describe('Accounts data model (e2e)', () => {
  let pg: StartedPostgres;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pg = await startPostgres();
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  it('creates a couple account with 2 members, interests and intents', async () => {
    const user = await prisma.user.create({ data: {} });
    const city = await prisma.city.create({
      data: { slug: 'c1', name: 'City', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2 },
    });
    const interest = await prisma.interest.create({ data: { slug: 'coffee', label: 'Кофе' } });

    const account = await prisma.account.create({
      data: {
        ownerUserId: user.id,
        kind: 'couple',
        cityId: city.id,
        intents: ['walks', 'deep-talks'],
        members: { create: [{ position: 0, name: 'A', age: 30 }, { position: 1, name: 'B', age: 28 }] },
        interests: { create: [{ interestId: interest.id }] },
      },
      include: { members: true, interests: true },
    });

    expect(account.members).toHaveLength(2);
    expect(account.interests).toHaveLength(1);
    expect(account.intents).toEqual(['walks', 'deep-talks']);
  });

  it('enforces one account per user (unique ownerUserId)', async () => {
    const user = await prisma.user.create({ data: {} });
    const city = await prisma.city.create({
      data: { slug: 'c2', name: 'City2', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2 },
    });
    const base = { ownerUserId: user.id, kind: 'single' as const, cityId: city.id };
    await prisma.account.create({ data: { ...base, members: { create: [{ position: 0, name: 'A', age: 30 }] } } });
    await expect(
      prisma.account.create({ data: { ...base, members: { create: [{ position: 0, name: 'A', age: 30 }] } } }),
    ).rejects.toThrow();
  });

  it('has a GIN index on accounts.intents', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'accounts_intents_gin'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef.toLowerCase()).toContain('using gin');
  });
});

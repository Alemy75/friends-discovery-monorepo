import { PrismaClient } from '@prisma/client';
import { startPostgres, seedTestDatabase, StartedPostgres } from './testcontainers';

describe('Seed (e2e)', () => {
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

  it('seeds Yaroslavl and 20 interests, idempotently', async () => {
    seedTestDatabase(pg.url);
    seedTestDatabase(pg.url); // повторный прогон не должен падать/дублировать

    const city = await prisma.city.findUnique({ where: { slug: 'yaroslavl' } });
    expect(city?.name).toBe('Ярославль');

    const interests = await prisma.interest.findMany();
    expect(interests).toHaveLength(20);
    const coffee = interests.filter((i) => i.slug === 'coffee');
    expect(coffee).toHaveLength(1);
  });
});

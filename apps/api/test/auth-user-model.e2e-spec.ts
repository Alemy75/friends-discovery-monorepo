import { startPostgres, StartedPostgres } from './testcontainers';
import { PrismaClient } from '@prisma/client';

describe('User + AuthIdentity model (integration)', () => {
  let pg: StartedPostgres;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pg = await startPostgres();
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
  }, 120000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  it('creates a user with a password identity and unique (provider,identifier)', async () => {
    const user = await prisma.user.create({
      data: {
        identities: {
          create: { provider: 'password', identifier: 'a@b.com', secretHash: 'x' },
        },
      },
      include: { identities: true },
    });
    expect(user.role).toBe('user');
    expect(user.status).toBe('active');
    expect(user.identities[0].verifiedAt).toBeNull();

    await expect(
      prisma.authIdentity.create({
        data: { userId: user.id, provider: 'password', identifier: 'a@b.com' },
      }),
    ).rejects.toThrow();
  });
});

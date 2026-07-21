import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('returns only active cities as CityDto', async () => {
    const prisma = {
      city: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2, isActive: true, createdAt: new Date() }]) },
      interest: { findMany: jest.fn() },
    } as any;
    const svc = new CatalogService(prisma);

    const cities = await svc.listCities();

    expect(prisma.city.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } });
    expect(cities).toEqual([{ id: 'c1', slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow' }]);
  });

  it('returns only active interests as InterestDto', async () => {
    const prisma = {
      city: { findMany: jest.fn() },
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee', label: 'Кофе', isActive: true }]) },
    } as any;
    const svc = new CatalogService(prisma);

    const interests = await svc.listInterests();

    expect(prisma.interest.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { label: 'asc' } });
    expect(interests).toEqual([{ slug: 'coffee', label: 'Кофе' }]);
  });
});

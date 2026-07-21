import { Injectable } from '@nestjs/common';
import { CityDto, InterestDto } from '@friends-ai/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(): Promise<CityDto[]> {
    const cities = await this.prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return cities.map((c) => ({ id: c.id, slug: c.slug, name: c.name, timezone: c.timezone }));
  }

  async listInterests(): Promise<InterestDto[]> {
    const interests = await this.prisma.interest.findMany({ where: { isActive: true }, orderBy: { label: 'asc' } });
    return interests.map((i) => ({ slug: i.slug, label: i.label }));
  }
}

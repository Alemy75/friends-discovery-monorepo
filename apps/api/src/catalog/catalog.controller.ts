import { Controller, Get } from '@nestjs/common';
import { CityDto, InterestDto } from '@friends-ai/contracts';
import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('cities')
  cities(): Promise<CityDto[]> {
    return this.catalog.listCities();
  }

  @Get('interests')
  interests(): Promise<InterestDto[]> {
    return this.catalog.listInterests();
  }
}

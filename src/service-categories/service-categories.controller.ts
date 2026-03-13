import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { ServiceCategoriesService } from './service-categories.service';

@ApiTags('Categories')
@Controller('categories')
export class ServiceCategoriesController {
  constructor(
    private readonly serviceCategoriesService: ServiceCategoriesService,
  ) {}

  @Public()
  @Get()
  listCategories(): Promise<Record<string, unknown>> {
    return this.serviceCategoriesService.listCategories();
  }
}

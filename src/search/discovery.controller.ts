import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { SearchDiscoveryDto } from './dto/search-discovery.dto';
import { SearchService } from './search.service';

@ApiTags('Discovery')
@Controller()
export class DiscoveryController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('service-owners')
  listServiceOwners(
    @Query() query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    return this.searchService.listServiceOwners(query);
  }
}

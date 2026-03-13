import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { SearchDiscoveryDto } from './dto/search-discovery.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  search(@Query() query: SearchDiscoveryDto): Promise<Record<string, unknown>> {
    return this.searchService.searchDiscovery(query);
  }
}

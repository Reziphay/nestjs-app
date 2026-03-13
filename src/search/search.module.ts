import { Module } from '@nestjs/common';

import { DiscoveryController } from './discovery.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController, DiscoveryController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

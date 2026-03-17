import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { DiscoveryController } from './discovery.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [StorageModule],
  controllers: [SearchController, DiscoveryController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

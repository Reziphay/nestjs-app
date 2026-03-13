import { Module } from '@nestjs/common';

import { BrandsModule } from '../brands/brands.module';
import { SearchDocumentsModule } from '../search-documents/search-documents.module';
import { SearchModule } from '../search/search.module';
import { StorageModule } from '../storage/storage.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [BrandsModule, SearchDocumentsModule, SearchModule, StorageModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}

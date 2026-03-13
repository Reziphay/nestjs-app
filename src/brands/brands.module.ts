import { Module } from '@nestjs/common';

import { SearchDocumentsModule } from '../search-documents/search-documents.module';
import { StorageModule } from '../storage/storage.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [StorageModule, SearchDocumentsModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}

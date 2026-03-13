import { Module } from '@nestjs/common';

import { SearchDocumentsService } from './search-documents.service';

@Module({
  providers: [SearchDocumentsService],
  exports: [SearchDocumentsService],
})
export class SearchDocumentsModule {}

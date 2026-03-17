import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { SearchDocumentsModule } from '../search-documents/search-documents.module';
import { StorageModule } from '../storage/storage.module';
import { FavoritesService } from './favorites.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule, SearchDocumentsModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService, FavoritesService],
  exports: [UsersService],
})
export class UsersModule {}

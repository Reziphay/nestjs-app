import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { SearchDocumentsModule } from '../search-documents/search-documents.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule, SearchDocumentsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

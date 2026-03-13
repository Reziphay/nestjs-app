import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

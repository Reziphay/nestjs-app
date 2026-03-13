import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDeliveryService } from './push-delivery.service';
import { PushTokensController } from './push-tokens.controller';

@Module({
  controllers: [NotificationsController, PushTokensController],
  providers: [NotificationsService, PushDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

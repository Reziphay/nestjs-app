import { Module, forwardRef } from '@nestjs/common';

import { ReservationsModule } from '../reservations/reservations.module';
import { NotificationPreferencesService } from './notification-preferences.service';

@Module({
  imports: [forwardRef(() => ReservationsModule)],
  providers: [NotificationPreferencesService],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}

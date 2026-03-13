import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListNotificationsDto,
  ): Promise<Record<string, unknown>> {
    return this.notificationsService.listNotifications(user.sub, query);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') notificationId: string,
  ): Promise<Record<string, unknown>> {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @Post('read-all')
  markAllRead(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.notificationsService.markAllRead(user.sub);
  }
}

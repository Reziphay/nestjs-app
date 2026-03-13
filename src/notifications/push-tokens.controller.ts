import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Push Tokens')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  registerPushToken(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<Record<string, unknown>> {
    return this.notificationsService.registerPushToken(user.sub, dto);
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.usersService.getMe(user.sub, user.sessionId);
  }

  @Post('me/activate-uso')
  activateUso(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.usersService.activateUso(user.sub, user.sessionId);
  }

  @Get('me/roles')
  roles(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.usersService.getRoles(user.sub, user.sessionId);
  }

  @Post('me/switch-role')
  switchRole(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SwitchRoleDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.switchRole(user.sub, user.sessionId, dto.role);
  }
}

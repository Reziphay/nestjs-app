import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
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

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updateProfile(user.sub, user.sessionId, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedRequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Record<string, unknown>> {
    return this.usersService.uploadAvatar(user.sub, user.sessionId, file);
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

  @Get('me/notification-settings')
  getNotificationSettings(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.usersService.getNotificationSettings(user.sub);
  }

  @Patch('me/notification-settings')
  updateNotificationSettings(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updateNotificationSettings(user.sub, dto);
  }
}

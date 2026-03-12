import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AuthenticatedRequestUser } from 'src/modules/auth/auth.types';
import {
  DeletePushDeviceResponseDto,
  RegisterPushDeviceDto,
  RegisterPushDeviceResponseDto,
  UpdateMeDto,
  UpdateUserSettingsDto,
} from 'src/modules/users/dto/users.dto';
import { UsersService } from 'src/modules/users/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.usersService.updateMe(auth.userId, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get current user notification settings' })
  getSettings(@CurrentAuth() auth: AuthenticatedRequestUser) {
    return this.usersService.getSettings(auth.userId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update current user notification settings' })
  updateSettings(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.usersService.updateSettings(auth.userId, dto);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register or reactivate a push device' })
  registerDevice(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Body() dto: RegisterPushDeviceDto,
  ): Promise<RegisterPushDeviceResponseDto> {
    return this.usersService.registerDevice(auth.userId, dto);
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Unregister a push device' })
  unregisterDevice(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Param('id') deviceId: string,
  ): Promise<DeletePushDeviceResponseDto> {
    return this.usersService.unregisterDevice(auth.userId, deviceId);
  }
}

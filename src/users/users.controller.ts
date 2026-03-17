import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/app-role.enum';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { FavoritesService } from './favorites.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly favoritesService: FavoritesService,
  ) {}

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

  // ── Favorites — Brands ────────────────────────────────────────────────────

  @Roles(AppRole.UCR)
  @Get('me/favorites/brands')
  getFavoriteBrands(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.getFavoriteBrands(user.sub);
  }

  @Roles(AppRole.UCR)
  @Post('me/favorites/brands/:id')
  @HttpCode(HttpStatus.OK)
  addFavoriteBrand(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.addFavoriteBrand(user.sub, brandId);
  }

  @Roles(AppRole.UCR)
  @Delete('me/favorites/brands/:id')
  @HttpCode(HttpStatus.OK)
  removeFavoriteBrand(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.removeFavoriteBrand(user.sub, brandId);
  }

  @Roles(AppRole.UCR)
  @Get('me/favorites/brands/:id/status')
  checkFavoriteBrand(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.checkFavoriteBrand(user.sub, brandId);
  }

  // ── Favorites — Owners ────────────────────────────────────────────────────

  @Roles(AppRole.UCR)
  @Get('me/favorites/owners')
  getFavoriteOwners(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.getFavoriteOwners(user.sub);
  }

  @Roles(AppRole.UCR)
  @Post('me/favorites/owners/:id')
  @HttpCode(HttpStatus.OK)
  addFavoriteOwner(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.addFavoriteOwner(user.sub, ownerUserId);
  }

  @Roles(AppRole.UCR)
  @Delete('me/favorites/owners/:id')
  @HttpCode(HttpStatus.OK)
  removeFavoriteOwner(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.removeFavoriteOwner(user.sub, ownerUserId);
  }

  @Roles(AppRole.UCR)
  @Get('me/favorites/owners/:id/status')
  checkFavoriteOwner(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.checkFavoriteOwner(user.sub, ownerUserId);
  }

  // ── Favorites — Services ──────────────────────────────────────────────────

  @Roles(AppRole.UCR)
  @Get('me/favorites/services')
  getFavoriteServices(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.getFavoriteServices(user.sub);
  }

  @Roles(AppRole.UCR)
  @Post('me/favorites/services/:id')
  @HttpCode(HttpStatus.OK)
  addFavoriteService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.addFavoriteService(user.sub, serviceId);
  }

  @Roles(AppRole.UCR)
  @Delete('me/favorites/services/:id')
  @HttpCode(HttpStatus.OK)
  removeFavoriteService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.removeFavoriteService(user.sub, serviceId);
  }

  @Roles(AppRole.UCR)
  @Get('me/favorites/services/:id/status')
  checkFavoriteService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.favoritesService.checkFavoriteService(user.sub, serviceId);
  }
}

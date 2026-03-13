import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/app-role.enum';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { BrandsService } from './brands.service';
import {
  CreateBrandJoinRequestDto,
  TransferBrandOwnershipDto,
} from './dto/brand-actions.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import { ListBrandsDto } from './dto/list-brands.dto';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get()
  listBrands(@Query() query: ListBrandsDto): Promise<Record<string, unknown>> {
    return this.brandsService.listBrands(query);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post()
  createBrand(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateBrandDto,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.createBrand(user.sub, dto);
  }

  @Public()
  @Get(':id')
  getBrand(@Param('id') brandId: string): Promise<Record<string, unknown>> {
    return this.brandsService.getBrand(brandId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Patch(':id')
  updateBrand(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.updateBrand(user.sub, brandId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.uploadLogo(user.sub, brandId, file);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/join-requests')
  createJoinRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @Body() dto: CreateBrandJoinRequestDto,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.createJoinRequest(user.sub, brandId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Get(':id/join-requests')
  listJoinRequests(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.listJoinRequests(user.sub, brandId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/join-requests/:requestId/accept')
  acceptJoinRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @Param('requestId') requestId: string,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.acceptJoinRequest(user.sub, brandId, requestId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/join-requests/:requestId/reject')
  rejectJoinRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @Param('requestId') requestId: string,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.rejectJoinRequest(user.sub, brandId, requestId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/transfer-ownership')
  transferOwnership(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') brandId: string,
    @Body() dto: TransferBrandOwnershipDto,
  ): Promise<Record<string, unknown>> {
    return this.brandsService.transferOwnership(user.sub, brandId, dto);
  }

  @Public()
  @Get(':id/members')
  listMembers(@Param('id') brandId: string): Promise<Record<string, unknown>> {
    return this.brandsService.listMembers(brandId);
  }
}

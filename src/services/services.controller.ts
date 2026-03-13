import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { SearchDiscoveryDto } from '../search/dto/search-discovery.dto';
import { SearchService } from '../search/search.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import {
  ReplaceServiceAvailabilityExceptionsDto,
  ReplaceServiceManualBlocksDto,
  ReplaceServiceAvailabilityRulesDto,
} from './dto/service-availability.dto';
import { ServicesService } from './services.service';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @Get()
  listServices(
    @Query() query: ListServicesDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.listServices(query);
  }

  @Public()
  @Get('nearby')
  listNearbyServices(
    @Query() query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    return this.searchService.listNearbyServices(query);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post()
  createService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateServiceDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.createService(user.sub, dto);
  }

  @Public()
  @Get(':id')
  getService(@Param('id') serviceId: string): Promise<Record<string, unknown>> {
    return this.servicesService.getService(serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Patch(':id')
  updateService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.updateService(user.sub, serviceId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Delete(':id')
  archiveService(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.archiveService(user.sub, serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Put(':id/availability-rules')
  replaceAvailabilityRules(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @Body() dto: ReplaceServiceAvailabilityRulesDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.replaceAvailabilityRules(
      user.sub,
      serviceId,
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Put(':id/manual-blocks')
  replaceManualBlocks(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @Body() dto: ReplaceServiceManualBlocksDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.replaceManualBlocks(user.sub, serviceId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Put(':id/availability-exceptions')
  replaceAvailabilityExceptions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @Body() dto: ReplaceServiceAvailabilityExceptionsDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.replaceAvailabilityExceptions(
      user.sub,
      serviceId,
      dto,
    );
  }

  @Public()
  @Get(':id/availability')
  getAvailability(
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.getAvailability(serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  addPhoto(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.addPhoto(user.sub, serviceId, file);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Roles(AppRole.USO)
  @Delete(':id/photos/:photoId')
  deletePhoto(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') serviceId: string,
    @Param('photoId') photoId: string,
  ): Promise<Record<string, boolean>> {
    return this.servicesService.deletePhoto(user.sub, serviceId, photoId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/app-role.enum';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { AdminService } from './admin.service';
import { CreateSponsoredVisibilityDto } from './dto/create-sponsored-visibility.dto';
import { ListAdminActivityDto } from './dto/list-admin-activity.dto';
import { ListAdminBrandsDto } from './dto/list-admin-brands.dto';
import { ListAdminReservationObjectionsDto } from './dto/list-admin-reservation-objections.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
import { ListAdminServicesDto } from './dto/list-admin-services.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { AdminUserActionDto } from './dto/admin-user-action.dto';
import { CloseUserDto, SuspendUserDto } from './dto/moderate-user.dto';
import {
  ResolveReportDto,
  ResolveReservationObjectionDto,
} from './dto/resolve-report.dto';
import {
  AssignVisibilityLabelDto,
  CreateVisibilityLabelDto,
  ListVisibilityLabelsDto,
  UnassignVisibilityLabelDto,
} from './dto/visibility-label.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Roles(AppRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview(): Promise<Record<string, unknown>> {
    return this.adminService.getOverview();
  }

  @Get('reports')
  listReports(
    @Query() query: ListAdminReportsDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listReports(query);
  }

  @Get('reports/:id')
  getReportDetail(
    @Param('id') reportId: string,
  ): Promise<Record<string, unknown>> {
    return this.adminService.getReportDetail(reportId);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reportId: string,
    @Body() dto: ResolveReportDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.resolveReport(user.sub, reportId, dto);
  }

  @Post('reports/:id/:action')
  applyReportAction(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reportId: string,
    @Param('action') action: string,
    @Body() dto: ResolveReportDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.applyReportAction(user.sub, reportId, action, dto);
  }

  @Get('reservation-objections')
  listReservationObjections(
    @Query() query: ListAdminReservationObjectionsDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listReservationObjections(query);
  }

  @Post('reservation-objections/:id/resolve')
  resolveReservationObjection(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') objectionId: string,
    @Body() dto: ResolveReservationObjectionDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.resolveReservationObjection(
      user.sub,
      objectionId,
      dto,
    );
  }

  @Get('users')
  listUsers(@Query() query: ListAdminUsersDto): Promise<Record<string, unknown>> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id/detail')
  getUserAdminDetail(
    @Param('id') userId: string,
  ): Promise<Record<string, unknown>> {
    return this.adminService.getUserAdminDetail(userId);
  }

  @Get('users/:id')
  getUser(@Param('id') userId: string): Promise<Record<string, unknown>> {
    return this.adminService.getUser(userId);
  }

  @Post('users/:id/suspend')
  suspendUser(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') targetUserId: string,
    @Body() dto: SuspendUserDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.suspendUser(user.sub, targetUserId, dto);
  }

  @Post('users/:id/close')
  closeUser(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') targetUserId: string,
    @Body() dto: CloseUserDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.closeUser(user.sub, targetUserId, dto);
  }

  @Post('users/:id/:action')
  applyUserAction(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') targetUserId: string,
    @Param('action') action: string,
    @Body() dto: AdminUserActionDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.applyUserAction(
      user.sub,
      targetUserId,
      action,
      dto,
    );
  }

  @Get('brands')
  listBrands(
    @Query() query: ListAdminBrandsDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listBrands(query);
  }

  @Get('brands/:id/detail')
  getBrandAdminDetail(
    @Param('id') brandId: string,
  ): Promise<Record<string, unknown>> {
    return this.adminService.getBrandAdminDetail(brandId);
  }

  @Get('brands/:id')
  getBrand(@Param('id') brandId: string): Promise<Record<string, unknown>> {
    return this.adminService.getBrand(brandId);
  }

  @Get('services')
  listServices(
    @Query() query: ListAdminServicesDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listServices(query);
  }

  @Get('services/:id/detail')
  getServiceAdminDetail(
    @Param('id') serviceId: string,
  ): Promise<Record<string, unknown>> {
    return this.adminService.getServiceAdminDetail(serviceId);
  }

  @Get('services/:id')
  getService(@Param('id') serviceId: string): Promise<Record<string, unknown>> {
    return this.adminService.getService(serviceId);
  }

  @Get('visibility-labels')
  listVisibilityLabels(
    @Query() query: ListVisibilityLabelsDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listVisibilityLabels(query);
  }

  @Post('visibility-labels')
  createVisibilityLabel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.createVisibilityLabel(user.sub, dto);
  }

  @Post('visibility-labels/:id/assign')
  assignVisibilityLabel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') labelId: string,
    @Body() dto: AssignVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.assignVisibilityLabel(user.sub, labelId, dto);
  }

  @Post('visibility-labels/:id/unassign')
  unassignVisibilityLabel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') labelId: string,
    @Body() dto: UnassignVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.unassignVisibilityLabel(user.sub, labelId, dto);
  }

  @Get('sponsored-visibility')
  listSponsoredVisibility(): Promise<Record<string, unknown>> {
    return this.adminService.listSponsoredVisibility();
  }

  @Post('sponsored-visibility')
  createSponsoredVisibility(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateSponsoredVisibilityDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.createSponsoredVisibility(user.sub, dto);
  }

  @Get('activity')
  listActivity(
    @Query() query: ListAdminActivityDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listActivity(query);
  }

  @Get('analytics/overview')
  getAnalyticsOverview(): Promise<Array<Record<string, unknown>>> {
    return this.adminService.getAnalyticsOverview();
  }
}

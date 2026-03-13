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
import { ListAdminReservationObjectionsDto } from './dto/list-admin-reservation-objections.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
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

  @Get('reports')
  listReports(
    @Query() query: ListAdminReportsDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listReports(query);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reportId: string,
    @Body() dto: ResolveReportDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.resolveReport(user.sub, reportId, dto);
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

  @Get('analytics/overview')
  getAnalyticsOverview(): Promise<Record<string, unknown>> {
    return this.adminService.getAnalyticsOverview();
  }
}

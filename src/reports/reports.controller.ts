import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  createReport(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateReportDto,
  ): Promise<Record<string, unknown>> {
    return this.reportsService.createReport(user.sub, dto);
  }
}

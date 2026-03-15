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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsDto } from './dto/list-reservations.dto';
import {
  CancelReservationDto,
  CompleteReservationByQrDto,
  CreateReservationChangeRequestDto,
  RejectReservationDto,
  UpdateReservationDelayStatusDto,
} from './dto/reservation-actions.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(AppRole.UCR)
  @Post()
  createReservation(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateReservationDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.createReservation(user.sub, dto);
  }

  @Roles(AppRole.UCR)
  @Get('my')
  listMyReservations(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListReservationsDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.listMyReservations(user.sub, query);
  }

  @Roles(AppRole.USO)
  @Get('incoming')
  listIncomingReservations(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListReservationsDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.listIncomingReservations(user.sub, query);
  }

  @Roles(AppRole.USO)
  @Get('incoming/stats')
  getIncomingStats(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.getIncomingStats(user.sub);
  }

  @Get(':id')
  getReservation(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.getReservation(user, reservationId);
  }

  @Roles(AppRole.USO)
  @Post(':id/accept')
  acceptReservation(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.acceptReservation(user.sub, reservationId);
  }

  @Roles(AppRole.USO)
  @Post(':id/reject')
  rejectReservation(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: RejectReservationDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.rejectReservation(
      user.sub,
      reservationId,
      dto,
    );
  }

  @Roles(AppRole.UCR)
  @Post(':id/cancel-by-customer')
  cancelByCustomer(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: CancelReservationDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.cancelByCustomer(
      user.sub,
      reservationId,
      dto,
    );
  }

  @Roles(AppRole.USO)
  @Post(':id/cancel-by-owner')
  cancelByOwner(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: CancelReservationDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.cancelByOwner(user.sub, reservationId, dto);
  }

  @Roles(AppRole.UCR, AppRole.USO)
  @Post(':id/change-requests')
  createChangeRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: CreateReservationChangeRequestDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.createChangeRequest(
      user.sub,
      reservationId,
      dto,
    );
  }

  @Roles(AppRole.UCR, AppRole.USO)
  @Post('change-requests/:id/accept')
  acceptChangeRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') changeRequestId: string,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.acceptChangeRequest(
      user.sub,
      changeRequestId,
    );
  }

  @Roles(AppRole.UCR, AppRole.USO)
  @Post('change-requests/:id/reject')
  rejectChangeRequest(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') changeRequestId: string,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.rejectChangeRequest(
      user.sub,
      changeRequestId,
    );
  }

  @Roles(AppRole.UCR)
  @Post(':id/delay-status')
  updateDelayStatus(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: UpdateReservationDelayStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.updateDelayStatus(
      user.sub,
      reservationId,
      dto,
    );
  }

  @Roles(AppRole.USO)
  @Post(':id/complete-manually')
  completeManually(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.completeManually(user.sub, reservationId);
  }

  @Roles(AppRole.UCR)
  @Post(':id/complete-by-qr')
  completeByQr(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: CompleteReservationByQrDto,
  ): Promise<Record<string, unknown>> {
    return this.reservationsService.completeByQr(user.sub, reservationId, dto);
  }
}

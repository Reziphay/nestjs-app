import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/app-role.enum';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CreateReservationObjectionDto } from './dto/create-reservation-objection.dto';
import { PenaltiesService } from './penalties.service';

@ApiTags('Reservation Objections')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reservations')
export class ReservationObjectionsController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Roles(AppRole.UCR)
  @Post(':id/objections')
  createObjection(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reservationId: string,
    @Body() dto: CreateReservationObjectionDto,
  ): Promise<Record<string, unknown>> {
    return this.penaltiesService.createReservationObjection(
      user.sub,
      reservationId,
      dto,
    );
  }
}

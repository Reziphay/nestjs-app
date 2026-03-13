import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReservationDelayStatus } from '@prisma/client';

export class RejectReservationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CancelReservationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreateReservationChangeRequestDto {
  @IsISO8601({ strict: true })
  requestedStartAt!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  requestedEndAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CompleteReservationByQrDto {
  @IsString()
  @IsNotEmpty()
  qrPayload!: string;
}

export class UpdateReservationDelayStatusDto {
  @IsEnum(ReservationDelayStatus)
  status!: ReservationDelayStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedArrivalMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

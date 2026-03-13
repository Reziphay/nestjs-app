import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  serviceId!: string;

  @IsISO8601({ strict: true })
  requestedStartAt!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  requestedEndAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  customerNote?: string;
}

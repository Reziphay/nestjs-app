import { ReservationObjectionType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReservationObjectionDto {
  @IsEnum(ReservationObjectionType)
  objectionType!: ReservationObjectionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  reason!: string;
}

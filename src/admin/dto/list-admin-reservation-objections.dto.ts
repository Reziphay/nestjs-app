import {
  ReservationObjectionStatus,
  ReservationObjectionType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListAdminReservationObjectionsDto {
  @ApiPropertyOptional({ enum: ReservationObjectionStatus })
  @IsOptional()
  @IsEnum(ReservationObjectionStatus)
  status?: ReservationObjectionStatus;

  @ApiPropertyOptional({ enum: ReservationObjectionType })
  @IsOptional()
  @IsEnum(ReservationObjectionType)
  objectionType?: ReservationObjectionType;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

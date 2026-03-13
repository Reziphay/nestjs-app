import { ReportStatus, ReservationObjectionStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] })
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}

export class ResolveReservationObjectionDto {
  @ApiProperty({
    enum: [
      ReservationObjectionStatus.ACCEPTED,
      ReservationObjectionStatus.REJECTED,
    ],
  })
  @IsEnum(ReservationObjectionStatus)
  status!: ReservationObjectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}

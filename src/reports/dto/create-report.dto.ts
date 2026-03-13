import { ApiProperty } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @ApiProperty({
    enum: ReportTargetType,
  })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  reason!: string;
}

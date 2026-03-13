import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

import { DayOfWeek } from '@prisma/client';

import { HH_MM_PATTERN } from '../../common/utils/time.util';

export class ServiceAvailabilityRuleDto {
  @ApiProperty({
    enum: DayOfWeek,
    enumName: 'DayOfWeek',
  })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({
    example: '09:00',
  })
  @IsString()
  @Matches(HH_MM_PATTERN)
  startTime!: string;

  @ApiProperty({
    example: '18:00',
  })
  @IsString()
  @Matches(HH_MM_PATTERN)
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceAvailabilityExceptionDto {
  @ApiProperty({
    example: '2026-04-05',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    example: '10:00',
  })
  @IsOptional()
  @IsString()
  @Matches(HH_MM_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({
    example: '16:00',
  })
  @IsOptional()
  @IsString()
  @Matches(HH_MM_PATTERN)
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isClosedAllDay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReplaceServiceAvailabilityRulesDto {
  @ApiProperty({
    type: [ServiceAvailabilityRuleDto],
  })
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityRuleDto)
  rules!: ServiceAvailabilityRuleDto[];
}

export class ReplaceServiceAvailabilityExceptionsDto {
  @ApiProperty({
    type: [ServiceAvailabilityExceptionDto],
  })
  @IsArray()
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityExceptionDto)
  exceptions!: ServiceAvailabilityExceptionDto[];
}

export class PartialServiceAvailabilityRuleDto extends PartialType(
  ServiceAvailabilityRuleDto,
) {}

export class PartialServiceAvailabilityExceptionDto extends PartialType(
  ServiceAvailabilityExceptionDto,
) {}

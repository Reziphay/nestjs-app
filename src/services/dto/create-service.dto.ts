import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApprovalMode, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ServiceAvailabilityExceptionDto,
  ServiceAvailabilityRuleDto,
} from './service-availability.dto';

export class CreateServiceAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullAddress!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeId?: string;
}

export class UpdateServiceAddressDto extends PartialType(
  CreateServiceAddressDto,
) {}

export class CreateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({
    type: CreateServiceAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateServiceAddressDto)
  address?: CreateServiceAddressDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceAmount?: number;

  @ApiPropertyOptional({
    example: 'AZN',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  priceCurrency?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  waitingTimeMinutes!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minAdvanceMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAdvanceMinutes?: number;

  @ApiProperty({
    enum: ServiceType,
    enumName: 'ServiceType',
  })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @ApiProperty({
    enum: ApprovalMode,
    enumName: 'ApprovalMode',
  })
  @IsEnum(ApprovalMode)
  approvalMode!: ApprovalMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  freeCancellationDeadlineMinutes?: number;

  @ApiPropertyOptional({
    type: [ServiceAvailabilityRuleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityRuleDto)
  availabilityRules?: ServiceAvailabilityRuleDto[];

  @ApiPropertyOptional({
    type: [ServiceAvailabilityExceptionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityExceptionDto)
  availabilityExceptions?: ServiceAvailabilityExceptionDto[];
}

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  addressId?: string | null;

  @ApiPropertyOptional({
    type: UpdateServiceAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateServiceAddressDto)
  address?: UpdateServiceAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  priceCurrency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  waitingTimeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minAdvanceMinutes?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAdvanceMinutes?: number | null;

  @ApiPropertyOptional({
    enum: ServiceType,
    enumName: 'ServiceType',
  })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    enum: ApprovalMode,
    enumName: 'ApprovalMode',
  })
  @IsOptional()
  @IsEnum(ApprovalMode)
  approvalMode?: ApprovalMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  freeCancellationDeadlineMinutes?: number | null;

  @ApiPropertyOptional({ type: [ServiceAvailabilityRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityRuleDto)
  availabilityRules?: ServiceAvailabilityRuleDto[];
}

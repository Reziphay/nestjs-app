import { ApprovalMode, ServiceType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsISO8601,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum SearchSortMode {
  RELEVANCE = 'RELEVANCE',
  PROXIMITY = 'PROXIMITY',
  RATING = 'RATING',
  PRICE_LOW = 'PRICE_LOW',
  PRICE_HIGH = 'PRICE_HIGH',
  POPULARITY = 'POPULARITY',
  AVAILABILITY = 'AVAILABILITY',
}

export class SearchDiscoveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({ enum: ApprovalMode })
  @IsOptional()
  @IsEnum(ApprovalMode)
  approvalMode?: ApprovalMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPriceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPriceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visibilityLabelSlug?: string;

  @ApiPropertyOptional({
    enum: SearchSortMode,
    default: SearchSortMode.RELEVANCE,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(Object.values(SearchSortMode))
  sortBy?: SearchSortMode;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Requested service start time used for availability-aware discovery.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  requestedStartAt?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Optional requested service end time used for availability-aware discovery.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  requestedEndAt?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'When true, only currently reservable services are returned for the requested window.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  availableOnly?: boolean;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by a previous discovery response.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

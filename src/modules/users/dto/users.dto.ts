import { PushPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizePushPlatform = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Vugar Safarzada' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Frontend developer',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.reziphay.local/avatar/user.png',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  avatarUrl?: string | null;
}

export class UserSettingsDto {
  @ApiProperty({ example: true })
  upcomingReminderEnabled!: boolean;

  @ApiProperty({ example: 60 })
  upcomingReminderMinutes!: number;

  @ApiProperty({ example: true })
  pushNotificationsEnabled!: boolean;

  @ApiProperty({ example: false })
  marketingNotificationsEnabled!: boolean;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  upcomingReminderEnabled?: boolean;

  @ApiPropertyOptional({
    example: 120,
    minimum: 1,
    maximum: 10080,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  upcomingReminderMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  marketingNotificationsEnabled?: boolean;
}

export class RegisterPushDeviceDto {
  @ApiProperty({ example: 'ExponentPushToken[example-token]' })
  @Transform(trimString)
  @IsString()
  @Length(1, 191)
  deviceToken!: string;

  @ApiProperty({
    enum: ['ios', 'android'],
    example: 'ios',
  })
  @Transform(normalizePushPlatform)
  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @ApiPropertyOptional({ example: 'iPhone 15' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  deviceName?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  appVersion?: string;
}

export class RegisterPushDeviceResponseDto {
  @ApiProperty()
  deviceId!: string;

  @ApiProperty({ example: true })
  registered!: true;
}

export class DeletePushDeviceResponseDto {
  @ApiProperty({ example: true })
  deleted!: true;
}

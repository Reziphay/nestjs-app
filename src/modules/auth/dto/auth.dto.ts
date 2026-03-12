import { UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RequestOtpDto {
  @ApiProperty({ example: '+15550000001' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  roleHint?: UserRole;
}

export class VerifyOtpDeviceDto {
  @ApiProperty({ example: 'ios' })
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @ApiPropertyOptional({ example: 'iPhone 15' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  appVersion?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'otp_req_123' })
  @IsString()
  @IsNotEmpty()
  otpRequestId!: string;

  @ApiProperty({ example: '+15550000001' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ type: VerifyOtpDeviceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VerifyOtpDeviceDto)
  device?: VerifyOtpDeviceDto;
}

export class RequestEmailVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'reziphay://auth/email-verify' })
  @Matches(/^[a-z][a-z0-9+.-]*:\/\/.+/i)
  redirectUri!: string;
}

export class VerifyEmailTokenQueryDto {
  @ApiProperty({ example: 'emv_123' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class SwitchRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import { OtpPurpose } from '../../common/enums/otp-purpose.enum';

export class RequestPhoneOtpDto {
  @ApiProperty({
    example: '+994501234567',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    enum: OtpPurpose,
    enumName: 'OtpPurpose',
    example: OtpPurpose.REGISTER,
  })
  @IsEnum(OtpPurpose)
  purpose!: (typeof OtpPurpose)[keyof typeof OtpPurpose];

  @ApiPropertyOptional({
    example: 'Aysel Karimova',
  })
  @ValidateIf(
    (value: RequestPhoneOtpDto) =>
      value.purpose === OtpPurpose.REGISTER,
  )
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'aysel@example.com',
  })
  @ValidateIf(
    (value: RequestPhoneOtpDto) =>
      value.purpose === OtpPurpose.REGISTER,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'iPhone 16 Pro',
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

import { OtpPurpose } from '../../common/enums/otp-purpose.enum';

export class VerifyPhoneOtpDto {
  @ApiProperty({
    example: '+994501234567',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code!: string;

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
    (value: VerifyPhoneOtpDto) => value.purpose === OtpPurpose.REGISTER,
  )
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'aysel@example.com',
  })
  @ValidateIf(
    (value: VerifyPhoneOtpDto) => value.purpose === OtpPurpose.REGISTER,
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

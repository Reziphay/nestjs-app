import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { AppRole } from '../../common/enums/app-role.enum';

export class CompleteRegistrationDto {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived registration token received from verify-phone-otp',
  })
  @IsString()
  @IsNotEmpty()
  registrationToken!: string;

  @ApiProperty({ example: 'Aysel Karimova' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'aysel@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: [AppRole.UCR, AppRole.USO], default: AppRole.UCR })
  @IsOptional()
  @IsEnum([AppRole.UCR, AppRole.USO])
  initialRole?: typeof AppRole.UCR | typeof AppRole.USO;
}

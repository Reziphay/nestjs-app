import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

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
}

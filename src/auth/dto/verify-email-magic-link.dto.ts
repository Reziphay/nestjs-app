import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailMagicLinkDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

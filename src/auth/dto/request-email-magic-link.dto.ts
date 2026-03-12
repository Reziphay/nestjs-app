import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class RequestEmailMagicLinkDto {
  @ApiPropertyOptional({
    example: 'aysel@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

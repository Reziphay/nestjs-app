import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListBrandsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

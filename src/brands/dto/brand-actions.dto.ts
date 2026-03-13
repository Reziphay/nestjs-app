import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBrandJoinRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class TransferBrandOwnershipDto {
  @ApiProperty()
  @IsUUID()
  targetUserId!: string;
}

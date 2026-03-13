import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class CloseUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

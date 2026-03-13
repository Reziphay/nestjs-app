import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSponsoredVisibilityDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  campaignName!: string;

  @ApiProperty({ enum: ['brand', 'service'] })
  @IsIn(['brand', 'service'])
  targetType!: 'brand' | 'service';

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note!: string;
}

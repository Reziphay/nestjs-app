import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { AdminListBaseDto } from './admin-list-base.dto';

export class ListAdminBrandsDto extends AdminListBaseDto {
  @ApiPropertyOptional({ enum: ['healthy', 'flagged'] })
  @IsOptional()
  @IsIn(['healthy', 'flagged'])
  status?: 'healthy' | 'flagged';
}

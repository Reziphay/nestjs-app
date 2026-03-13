import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { AdminListBaseDto } from './admin-list-base.dto';

export class ListAdminServicesDto extends AdminListBaseDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'flagged'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'flagged'])
  status?: 'active' | 'paused' | 'flagged';
}

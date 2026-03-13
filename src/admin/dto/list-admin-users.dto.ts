import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { AdminListBaseDto } from './admin-list-base.dto';

export class ListAdminUsersDto extends AdminListBaseDto {
  @ApiPropertyOptional({ enum: ['active', 'suspended', 'closed'] })
  @IsOptional()
  @IsIn(['active', 'suspended', 'closed'])
  status?: 'active' | 'suspended' | 'closed';
}

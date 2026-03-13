import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { AdminListBaseDto } from './admin-list-base.dto';

export class ListAdminActivityDto extends AdminListBaseDto {
  @ApiPropertyOptional({
    enum: ['moderation', 'visibility', 'account', 'sponsorship'],
  })
  @IsOptional()
  @IsIn(['moderation', 'visibility', 'account', 'sponsorship'])
  category?: 'moderation' | 'visibility' | 'account' | 'sponsorship';
}

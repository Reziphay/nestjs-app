import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { AppRole } from '../../common/enums/app-role.enum';

export class SwitchRoleDto {
  @ApiProperty({
    enum: AppRole,
    enumName: 'AppRole',
    example: AppRole.USO,
  })
  @IsEnum(AppRole)
  role!: (typeof AppRole)[keyof typeof AppRole];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

class UpcomingAppointmentReminderSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  leadMinutes?: number[];
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    type: UpcomingAppointmentReminderSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpcomingAppointmentReminderSettingsDto)
  upcomingAppointmentReminders?: UpcomingAppointmentReminderSettingsDto;
}

import { PushPlatform } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4_096)
  token!: string;
}

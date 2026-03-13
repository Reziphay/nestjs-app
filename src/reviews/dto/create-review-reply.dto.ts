import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReviewReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  comment!: string;
}

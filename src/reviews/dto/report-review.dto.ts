import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  reason!: string;
}

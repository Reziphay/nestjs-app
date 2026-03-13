import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/app-role.enum';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(AppRole.UCR)
  @Post()
  createReview(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateReviewDto,
  ): Promise<Record<string, unknown>> {
    return this.reviewsService.createReview(user.sub, dto);
  }

  @Roles(AppRole.UCR)
  @Delete(':id')
  deleteReview(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reviewId: string,
  ): Promise<Record<string, unknown>> {
    return this.reviewsService.deleteReview(user.sub, reviewId);
  }

  @Roles(AppRole.USO)
  @Post(':id/replies')
  addReply(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reviewId: string,
    @Body() dto: CreateReviewReplyDto,
  ): Promise<Record<string, unknown>> {
    return this.reviewsService.addReply(user.sub, reviewId, dto);
  }

  @Post(':id/report')
  reportReview(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') reviewId: string,
    @Body() dto: ReportReviewDto,
  ): Promise<Record<string, unknown>> {
    return this.reviewsService.reportReview(user.sub, reviewId, dto);
  }
}

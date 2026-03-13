import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  Prisma,
  ReportStatus,
  ReportTargetType,
  ReservationStatus,
  ReviewTargetType,
} from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { ReportReviewDto } from './dto/report-review.dto';

const reviewInclude = {
  authorUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
  service: {
    select: {
      id: true,
      name: true,
    },
  },
  serviceOwnerUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
    },
  },
  targets: {
    orderBy: {
      targetType: 'asc',
    },
  },
  replies: {
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      authorUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.ReviewInclude;

type ReviewRecord = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);

    const reservation = await this.prisma.reservation.findUnique({
      where: {
        id: dto.reservationId,
      },
      select: {
        id: true,
        status: true,
        customerUserId: true,
        serviceId: true,
        serviceOwnerUserId: true,
        brandId: true,
        service: {
          select: {
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found.');
    }

    if (reservation.customerUserId !== userId) {
      throw new ForbiddenException(
        'Only the reservation customer can create a review.',
      );
    }

    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new ConflictException(
        'Reviews are only allowed for completed reservations.',
      );
    }

    const existingReview = await this.prisma.review.findUnique({
      where: {
        reservationId_authorUserId: {
          reservationId: reservation.id,
          authorUserId: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingReview) {
      throw new ConflictException(
        'This reservation has already been reviewed by you.',
      );
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          reservationId: reservation.id,
          authorUserId: userId,
          serviceId: reservation.serviceId,
          serviceOwnerUserId: reservation.serviceOwnerUserId,
          brandId: reservation.brandId,
          rating: dto.rating,
          comment: dto.comment.trim(),
        },
      });

      await tx.reviewTarget.createMany({
        data: [
          {
            reviewId: createdReview.id,
            targetType: ReviewTargetType.SERVICE,
            targetId: reservation.serviceId,
          },
          {
            reviewId: createdReview.id,
            targetType: ReviewTargetType.SERVICE_OWNER,
            targetId: reservation.serviceOwnerUserId,
          },
          ...(reservation.brandId
            ? [
                {
                  reviewId: createdReview.id,
                  targetType: ReviewTargetType.BRAND,
                  targetId: reservation.brandId,
                },
              ]
            : []),
        ],
      });

      await this.refreshRatingStats(tx, {
        serviceId: reservation.serviceId,
        serviceOwnerUserId: reservation.serviceOwnerUserId,
        brandId: reservation.brandId,
      });

      return tx.review.findUniqueOrThrow({
        where: {
          id: createdReview.id,
        },
        include: reviewInclude,
      });
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReviewReceived({
        reviewId: review.id,
        recipientUserIds: [
          review.serviceOwnerUser?.id ?? '',
          reservation.brand?.ownerUserId ?? '',
        ].filter(Boolean),
        serviceName: reservation.service.name,
      }),
    );

    return {
      review: this.serializeReview(review),
    };
  }

  async deleteReview(
    userId: string,
    reviewId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);

    const review = await this.prisma.review.findUnique({
      where: {
        id: reviewId,
      },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.authorUser.id !== userId) {
      throw new ForbiddenException('Only the review author can delete it.');
    }

    if (review.isDeleted) {
      throw new ConflictException('This review has already been deleted.');
    }

    const deletedReview = await this.prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: {
          id: review.id,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await this.refreshRatingStats(tx, {
        serviceId: review.service?.id ?? null,
        serviceOwnerUserId: review.serviceOwnerUser?.id ?? null,
        brandId: review.brand?.id ?? null,
      });

      return tx.review.findUniqueOrThrow({
        where: {
          id: review.id,
        },
        include: reviewInclude,
      });
    });

    return {
      review: this.serializeReview(deletedReview),
    };
  }

  async addReply(
    userId: string,
    reviewId: string,
    dto: CreateReviewReplyDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);

    const review = await this.prisma.review.findUnique({
      where: {
        id: reviewId,
      },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.isDeleted) {
      throw new ConflictException('Deleted reviews cannot be replied to.');
    }

    const canReplyAsBrandMember = review.brand
      ? await this.prisma.brandMembership.findUnique({
          where: {
            brandId_userId: {
              brandId: review.brand.id,
              userId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        })
      : null;

    if (
      review.serviceOwnerUser?.id !== userId &&
      canReplyAsBrandMember?.status !== 'ACTIVE'
    ) {
      throw new ForbiddenException(
        'Only the service owner or an active brand member can reply.',
      );
    }

    const reply = await this.prisma.reviewReply.upsert({
      where: {
        reviewId_authorUserId: {
          reviewId,
          authorUserId: userId,
        },
      },
      update: {
        comment: dto.comment.trim(),
      },
      create: {
        reviewId,
        authorUserId: userId,
        comment: dto.comment.trim(),
      },
      include: {
        authorUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      reply: {
        id: reply.id,
        comment: reply.comment,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        authorUser: reply.authorUser,
      },
    };
  }

  async reportReview(
    userId: string,
    reviewId: string,
    dto: ReportReviewDto,
  ): Promise<Record<string, unknown>> {
    const review = await this.prisma.review.findUnique({
      where: {
        id: reviewId,
      },
      select: {
        id: true,
        isDeleted: true,
      },
    });

    if (!review || review.isDeleted) {
      throw new NotFoundException('Review not found.');
    }

    const existingOpenReport = await this.prisma.report.findFirst({
      where: {
        reporterUserId: userId,
        targetType: ReportTargetType.REVIEW,
        targetId: reviewId,
        status: {
          in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW],
        },
      },
      select: {
        id: true,
      },
    });

    if (existingOpenReport) {
      throw new ConflictException(
        'You already have an open report for this review.',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        reporterUserId: userId,
        targetType: ReportTargetType.REVIEW,
        targetId: reviewId,
        reason: dto.reason.trim(),
      },
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReviewReported({
        reportId: report.id,
      }),
    );

    return {
      report: {
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    };
  }

  private async refreshRatingStats(
    tx: Prisma.TransactionClient,
    input: {
      serviceId: string | null;
      serviceOwnerUserId: string | null;
      brandId: string | null;
    },
  ): Promise<void> {
    if (input.serviceId) {
      const aggregate = await tx.review.aggregate({
        where: {
          serviceId: input.serviceId,
          isDeleted: false,
        },
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
      });

      await tx.serviceRatingStat.upsert({
        where: {
          serviceId: input.serviceId,
        },
        update: {
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
        create: {
          serviceId: input.serviceId,
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
      });
    }

    if (input.serviceOwnerUserId) {
      const aggregate = await tx.review.aggregate({
        where: {
          serviceOwnerUserId: input.serviceOwnerUserId,
          isDeleted: false,
        },
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
      });

      await tx.serviceOwnerRatingStat.upsert({
        where: {
          userId: input.serviceOwnerUserId,
        },
        update: {
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
        create: {
          userId: input.serviceOwnerUserId,
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
      });
    }

    if (input.brandId) {
      const aggregate = await tx.review.aggregate({
        where: {
          brandId: input.brandId,
          isDeleted: false,
        },
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
      });

      await tx.brandRatingStat.upsert({
        where: {
          brandId: input.brandId,
        },
        update: {
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
        create: {
          brandId: input.brandId,
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.id,
        },
      });
    }
  }

  private async assertRole(userId: string, role: AppRole): Promise<void> {
    const roleRecord = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
    });

    if (!roleRecord) {
      throw new ForbiddenException(`This action requires the ${role} role.`);
    }
  }

  private async runNotificationSafely(
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error(
        'Notification dispatch failed during reviews flow.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private serializeReview(review: ReviewRecord): Record<string, unknown> {
    return {
      id: review.id,
      reservationId: review.reservationId,
      rating: review.rating,
      comment: review.comment,
      isDeleted: review.isDeleted,
      deletedAt: review.deletedAt,
      createdAt: review.createdAt,
      authorUser: review.authorUser,
      service: review.service,
      serviceOwnerUser: review.serviceOwnerUser,
      brand: review.brand,
      targets: review.targets,
      replies: review.replies.map((reply) => ({
        id: reply.id,
        comment: reply.comment,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        authorUser: reply.authorUser,
      })),
    };
  }
}

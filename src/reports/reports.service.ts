import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BrandMembershipStatus,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

type ReportCreationTargetSummary =
  | {
      id: string;
      type: 'USER';
      fullName: string;
      status: string;
    }
  | {
      id: string;
      type: 'BRAND';
      name: string;
      status: string;
    }
  | {
      id: string;
      type: 'SERVICE';
      name: string;
      ownerUserId: string;
      ownerFullName: string;
      isActive: boolean;
    }
  | {
      id: string;
      type: 'REVIEW';
      rating: number;
      comment: string;
    };

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReport(
    userId: string,
    dto: CreateReportDto,
  ): Promise<Record<string, unknown>> {
    const targetSummary = await this.getTargetSummaryOrThrow(
      userId,
      dto.targetType,
      dto.targetId,
    );

    const existingOpenReport = await this.prisma.report.findFirst({
      where: {
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
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
        'You already have an open report for this target.',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim(),
      },
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReportReceived({
        reportId: report.id,
        targetType: report.targetType,
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
        targetSummary,
      },
    };
  }

  async createReviewReport(
    userId: string,
    reviewId: string,
    reason: string,
  ): Promise<Record<string, unknown>> {
    return this.createReport(userId, {
      targetType: ReportTargetType.REVIEW,
      targetId: reviewId,
      reason,
    });
  }

  private async getTargetSummaryOrThrow(
    userId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ReportCreationTargetSummary> {
    switch (targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
            fullName: true,
            status: true,
          },
        });

        if (!user) {
          throw new NotFoundException('Report target not found.');
        }

        if (user.id === userId) {
          throw new ForbiddenException('You cannot report your own account.');
        }

        return {
          id: user.id,
          type: ReportTargetType.USER,
          fullName: user.fullName,
          status: user.status,
        };
      }
      case ReportTargetType.BRAND: {
        const brand = await this.prisma.brand.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
            name: true,
            ownerUserId: true,
            status: true,
          },
        });

        if (!brand) {
          throw new NotFoundException('Report target not found.');
        }

        if (brand.ownerUserId === userId) {
          throw new ForbiddenException('You cannot report your own brand.');
        }

        const activeMembership = await this.prisma.brandMembership.findUnique({
          where: {
            brandId_userId: {
              brandId: brand.id,
              userId,
            },
          },
          select: {
            status: true,
          },
        });

        if (activeMembership?.status === BrandMembershipStatus.ACTIVE) {
          throw new ForbiddenException(
            'You cannot report a brand you actively belong to.',
          );
        }

        return {
          id: brand.id,
          type: ReportTargetType.BRAND,
          name: brand.name,
          status: brand.status,
        };
      }
      case ReportTargetType.SERVICE: {
        const service = await this.prisma.service.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
            name: true,
            ownerUserId: true,
            isActive: true,
            ownerUser: {
              select: {
                fullName: true,
              },
            },
          },
        });

        if (!service) {
          throw new NotFoundException('Report target not found.');
        }

        if (service.ownerUserId === userId) {
          throw new ForbiddenException('You cannot report your own service.');
        }

        return {
          id: service.id,
          type: ReportTargetType.SERVICE,
          name: service.name,
          ownerUserId: service.ownerUserId,
          ownerFullName: service.ownerUser.fullName,
          isActive: service.isActive,
        };
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            isDeleted: true,
            authorUserId: true,
          },
        });

        if (!review || review.isDeleted) {
          throw new NotFoundException('Report target not found.');
        }

        if (review.authorUserId === userId) {
          throw new ForbiddenException('You cannot report your own review.');
        }

        return {
          id: review.id,
          type: ReportTargetType.REVIEW,
          rating: review.rating,
          comment: review.comment,
        };
      }
      default:
        throw new NotFoundException('Report target not found.');
    }
  }

  private async runNotificationSafely(
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error(
        'Notification dispatch failed during reports flow.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

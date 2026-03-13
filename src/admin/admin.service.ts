import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditTargetType,
  PenaltyReason,
  Prisma,
  ReportStatus,
  ReportTargetType,
  ReservationObjectionStatus,
  UserStatus,
  VisibilityTargetType,
  type BrandVisibilityAssignment,
  type ServiceVisibilityAssignment,
  type UserVisibilityAssignment,
  type VisibilityLabel,
} from '@prisma/client';

import { PenaltiesService } from '../penalties/penalties.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListAdminReservationObjectionsDto } from './dto/list-admin-reservation-objections.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
import { CloseUserDto, SuspendUserDto } from './dto/moderate-user.dto';
import {
  ResolveReportDto,
  ResolveReservationObjectionDto,
} from './dto/resolve-report.dto';
import {
  AssignVisibilityLabelDto,
  CreateVisibilityLabelDto,
  ListVisibilityLabelsDto,
  UnassignVisibilityLabelDto,
} from './dto/visibility-label.dto';

const reportInclude = {
  reporterUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  handledByAdmin: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.ReportInclude;

const objectionInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  resolvedByAdmin: {
    select: {
      id: true,
      fullName: true,
    },
  },
  reservation: {
    select: {
      id: true,
      status: true,
      requestedStartAt: true,
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ReservationObjectionInclude;

const visibilityLabelInclude = {
  _count: {
    select: {
      brandAssignments: true,
      serviceAssignments: true,
      userAssignments: true,
    },
  },
} satisfies Prisma.VisibilityLabelInclude;

type ReportRecord = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

type ReservationObjectionRecord = Prisma.ReservationObjectionGetPayload<{
  include: typeof objectionInclude;
}>;

type VisibilityLabelRecord = Prisma.VisibilityLabelGetPayload<{
  include: typeof visibilityLabelInclude;
}>;

type VisibilityAssignmentRecord =
  | BrandVisibilityAssignment
  | ServiceVisibilityAssignment
  | UserVisibilityAssignment;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  async listReports(
    query: ListAdminReportsDto,
  ): Promise<Record<string, unknown>> {
    const reports = await this.prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      include: reportInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 50,
    });

    const reviewIds = reports
      .filter((report) => report.targetType === ReportTargetType.REVIEW)
      .map((report) => report.targetId);
    const reviews = reviewIds.length
      ? await this.prisma.review.findMany({
          where: {
            id: {
              in: reviewIds,
            },
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            isDeleted: true,
          },
        })
      : [];
    const reviewMap = new Map(reviews.map((review) => [review.id, review]));

    return {
      items: reports.map((report) => ({
        ...this.serializeReport(report),
        targetSummary:
          report.targetType === ReportTargetType.REVIEW
            ? (reviewMap.get(report.targetId) ?? null)
            : null,
      })),
    };
  }

  async resolveReport(
    adminUserId: string,
    reportId: string,
    dto: ResolveReportDto,
  ): Promise<Record<string, unknown>> {
    if (
      dto.status !== ReportStatus.RESOLVED &&
      dto.status !== ReportStatus.DISMISSED
    ) {
      throw new BadRequestException(
        'Reports can only be resolved or dismissed.',
      );
    }

    const report = await this.prisma.report.findUnique({
      where: {
        id: reportId,
      },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    if (
      report.status === ReportStatus.RESOLVED ||
      report.status === ReportStatus.DISMISSED
    ) {
      throw new ConflictException('This report has already been finalized.');
    }

    const updatedReport = await this.prisma.$transaction(async (tx) => {
      const resolvedReport = await tx.report.update({
        where: {
          id: report.id,
        },
        data: {
          status: dto.status,
          handledByAdminId: adminUserId,
          resolvedAt: new Date(),
        },
        include: reportInclude,
      });

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'REPORT_RESOLVED',
        targetType: AdminAuditTargetType.REPORT,
        targetId: report.id,
        detailsJson: {
          status: dto.status,
          note: dto.note?.trim() || null,
          previousStatus: report.status,
        },
      });

      return resolvedReport;
    });

    return {
      report: this.serializeReport(updatedReport),
    };
  }

  async listReservationObjections(
    query: ListAdminReservationObjectionsDto,
  ): Promise<Record<string, unknown>> {
    const objections = await this.prisma.reservationObjection.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.objectionType ? { objectionType: query.objectionType } : {}),
      },
      include: objectionInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 50,
    });

    return {
      items: objections.map((objection) =>
        this.serializeReservationObjection(objection),
      ),
    };
  }

  async resolveReservationObjection(
    adminUserId: string,
    objectionId: string,
    dto: ResolveReservationObjectionDto,
  ): Promise<Record<string, unknown>> {
    if (
      dto.status !== ReservationObjectionStatus.ACCEPTED &&
      dto.status !== ReservationObjectionStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Objections can only be accepted or rejected.',
      );
    }

    const objection = await this.prisma.reservationObjection.findUnique({
      where: {
        id: objectionId,
      },
      include: objectionInclude,
    });

    if (!objection) {
      throw new NotFoundException('Reservation objection not found.');
    }

    if (objection.status !== ReservationObjectionStatus.PENDING) {
      throw new ConflictException('This objection has already been finalized.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedObjection = await tx.reservationObjection.update({
        where: {
          id: objection.id,
        },
        data: {
          status: dto.status,
          resolvedByAdminId: adminUserId,
          resolvedAt: new Date(),
        },
        include: objectionInclude,
      });

      const deactivatedPenaltyPoints =
        dto.status === ReservationObjectionStatus.ACCEPTED
          ? await tx.penaltyPoint.updateMany({
              where: {
                userId: objection.userId,
                reservationId: objection.reservationId,
                reason: PenaltyReason.NO_SHOW,
                isActive: true,
              },
              data: {
                isActive: false,
              },
            })
          : { count: 0 };

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'RESERVATION_OBJECTION_RESOLVED',
        targetType: AdminAuditTargetType.RESERVATION_OBJECTION,
        targetId: objection.id,
        detailsJson: {
          status: dto.status,
          note: dto.note?.trim() || null,
          deactivatedPenaltyPoints: deactivatedPenaltyPoints.count,
        },
      });

      return {
        updatedObjection,
        deactivatedPenaltyPoints: deactivatedPenaltyPoints.count,
      };
    });

    if (dto.status === ReservationObjectionStatus.ACCEPTED) {
      await this.penaltiesService.recalculatePenaltyStateForUser(
        objection.user.id,
      );
    }

    return {
      objection: this.serializeReservationObjection(result.updatedObjection),
      deactivatedPenaltyPoints: result.deactivatedPenaltyPoints,
    };
  }

  async suspendUser(
    adminUserId: string,
    targetUserId: string,
    dto: SuspendUserDto,
  ): Promise<Record<string, unknown>> {
    await this.assertModeratableUser(adminUserId, targetUserId);
    const now = new Date();
    const suspendedUntil = this.addDays(now, dto.durationDays);

    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: targetUserId,
        },
        data: {
          status: UserStatus.SUSPENDED,
          suspendedUntil,
          closedReason: null,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          suspendedUntil: true,
          closedReason: true,
          updatedAt: true,
        },
      });

      await this.revokeActiveSessions(tx, targetUserId, now);
      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'USER_SUSPENDED',
        targetType: AdminAuditTargetType.USER,
        targetId: targetUserId,
        detailsJson: {
          durationDays: dto.durationDays,
          reason: dto.reason.trim(),
          suspendedUntil,
        },
      });

      return updatedUser;
    });

    return {
      user,
    };
  }

  async closeUser(
    adminUserId: string,
    targetUserId: string,
    dto: CloseUserDto,
  ): Promise<Record<string, unknown>> {
    await this.assertModeratableUser(adminUserId, targetUserId);
    const now = new Date();

    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: targetUserId,
        },
        data: {
          status: UserStatus.CLOSED,
          suspendedUntil: null,
          closedReason: dto.reason.trim(),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          suspendedUntil: true,
          closedReason: true,
          updatedAt: true,
        },
      });

      await this.revokeActiveSessions(tx, targetUserId, now);
      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'USER_CLOSED',
        targetType: AdminAuditTargetType.USER,
        targetId: targetUserId,
        detailsJson: {
          reason: dto.reason.trim(),
        },
      });

      return updatedUser;
    });

    return {
      user,
    };
  }

  async listVisibilityLabels(
    query: ListVisibilityLabelsDto,
  ): Promise<Record<string, unknown>> {
    const labels = await this.prisma.visibilityLabel.findMany({
      where: {
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      include: visibilityLabelInclude,
      orderBy: [
        { targetType: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return {
      items: labels.map((label) => this.serializeVisibilityLabel(label)),
    };
  }

  async createVisibilityLabel(
    adminUserId: string,
    dto: CreateVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    const label = await this.prisma.visibilityLabel.create({
      data: {
        name: dto.name.trim(),
        slug: this.normalizeSlug(dto.slug),
        targetType: dto.targetType,
        description: dto.description?.trim() || null,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
        createdByAdminId: adminUserId,
      },
      include: visibilityLabelInclude,
    });

    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId: adminUserId,
        action: 'VISIBILITY_LABEL_CREATED',
        targetType: AdminAuditTargetType.VISIBILITY_LABEL,
        targetId: label.id,
        detailsJson: {
          targetType: dto.targetType,
          slug: label.slug,
          priority: label.priority,
        },
      },
    });

    return {
      visibilityLabel: this.serializeVisibilityLabel(label),
    };
  }

  async assignVisibilityLabel(
    adminUserId: string,
    labelId: string,
    dto: AssignVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    const label = await this.prisma.visibilityLabel.findUnique({
      where: {
        id: labelId,
      },
      include: visibilityLabelInclude,
    });

    if (!label) {
      throw new NotFoundException('Visibility label not found.');
    }

    if (!label.isActive) {
      throw new ConflictException(
        'Inactive visibility labels cannot be assigned.',
      );
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.assertValidVisibilityWindow(startsAt, endsAt);
    await this.assertVisibilityTargetExists(label.targetType, dto.targetId);
    await this.assertNoOverlappingAssignment(
      label.targetType,
      label.id,
      dto.targetId,
      startsAt,
      endsAt,
    );

    const assignment = await this.prisma.$transaction(async (tx) => {
      const createdAssignment = await this.createVisibilityAssignment(tx, {
        targetType: label.targetType,
        labelId: label.id,
        targetId: dto.targetId,
        createdByAdminId: adminUserId,
        startsAt,
        endsAt,
      });

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'VISIBILITY_LABEL_ASSIGNED',
        targetType: this.resolveVisibilityAssignmentAuditTarget(
          label.targetType,
        ),
        targetId: createdAssignment.id,
        detailsJson: {
          labelId: label.id,
          targetId: dto.targetId,
          startsAt,
          endsAt,
        },
      });

      return createdAssignment;
    });

    return {
      visibilityLabel: this.serializeVisibilityLabel(label),
      assignment: this.serializeVisibilityAssignment(
        label.targetType,
        assignment,
        label,
      ),
    };
  }

  async unassignVisibilityLabel(
    adminUserId: string,
    labelId: string,
    dto: UnassignVisibilityLabelDto,
  ): Promise<Record<string, unknown>> {
    const label = await this.prisma.visibilityLabel.findUnique({
      where: {
        id: labelId,
      },
      include: visibilityLabelInclude,
    });

    if (!label) {
      throw new NotFoundException('Visibility label not found.');
    }

    const endsAt = dto.endsAt ? new Date(dto.endsAt) : new Date();
    const assignment = await this.findActiveVisibilityAssignment(
      label.targetType,
      label.id,
      dto.targetId,
      endsAt,
    );

    if (!assignment) {
      throw new NotFoundException('Active visibility assignment not found.');
    }

    if (assignment.startsAt.getTime() > endsAt.getTime()) {
      throw new BadRequestException(
        'The unassign time cannot be earlier than the assignment start time.',
      );
    }

    const updatedAssignment = await this.prisma.$transaction(async (tx) => {
      const endedAssignment = await this.endVisibilityAssignment(tx, {
        targetType: label.targetType,
        assignmentId: assignment.id,
        endsAt,
      });

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'VISIBILITY_LABEL_UNASSIGNED',
        targetType: this.resolveVisibilityAssignmentAuditTarget(
          label.targetType,
        ),
        targetId: assignment.id,
        detailsJson: {
          labelId: label.id,
          targetId: dto.targetId,
          endsAt,
        },
      });

      return endedAssignment;
    });

    return {
      visibilityLabel: this.serializeVisibilityLabel(label),
      assignment: this.serializeVisibilityAssignment(
        label.targetType,
        updatedAssignment,
        label,
      ),
    };
  }

  async getAnalyticsOverview(): Promise<Record<string, unknown>> {
    const now = new Date();
    const [
      userStatusCounts,
      brandStatusCounts,
      serviceTotals,
      reservationStatusCounts,
      reportStatusCounts,
      objectionStatusCounts,
      reviewCount,
      activeBrandVisibilityCount,
      activeServiceVisibilityCount,
      activeUserVisibilityCount,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.brand.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      Promise.all([
        this.prisma.service.count(),
        this.prisma.service.count({
          where: {
            isActive: true,
          },
        }),
      ]),
      this.prisma.reservation.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.report.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.reservationObjection.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.review.count({
        where: {
          isDeleted: false,
        },
      }),
      this.prisma.brandVisibilityAssignment.count({
        where: {
          startsAt: {
            lte: now,
          },
          OR: [
            {
              endsAt: null,
            },
            {
              endsAt: {
                gt: now,
              },
            },
          ],
        },
      }),
      this.prisma.serviceVisibilityAssignment.count({
        where: {
          startsAt: {
            lte: now,
          },
          OR: [
            {
              endsAt: null,
            },
            {
              endsAt: {
                gt: now,
              },
            },
          ],
        },
      }),
      this.prisma.userVisibilityAssignment.count({
        where: {
          startsAt: {
            lte: now,
          },
          OR: [
            {
              endsAt: null,
            },
            {
              endsAt: {
                gt: now,
              },
            },
          ],
        },
      }),
    ]);

    return {
      users: this.indexCounts(userStatusCounts),
      brands: this.indexCounts(brandStatusCounts),
      services: {
        total: serviceTotals[0],
        active: serviceTotals[1],
        inactive: serviceTotals[0] - serviceTotals[1],
      },
      reservations: this.indexCounts(reservationStatusCounts),
      reports: this.indexCounts(reportStatusCounts),
      reservationObjections: this.indexCounts(objectionStatusCounts),
      reviews: {
        total: reviewCount,
      },
      activeVisibilityAssignments: {
        brands: activeBrandVisibilityCount,
        services: activeServiceVisibilityCount,
        users: activeUserVisibilityCount,
      },
    };
  }

  private async assertModeratableUser(
    adminUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (adminUserId === targetUserId) {
      throw new BadRequestException(
        'Admins cannot suspend or close their own account.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    input: {
      actorUserId: string;
      action: string;
      targetType: AdminAuditTargetType;
      targetId: string;
      detailsJson?: Prisma.InputJsonValue | null;
    },
  ): Promise<void> {
    await tx.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.detailsJson !== undefined
          ? {
              detailsJson:
                input.detailsJson === null
                  ? Prisma.JsonNull
                  : input.detailsJson,
            }
          : {}),
      },
    });
  }

  private async revokeActiveSessions(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    await tx.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
  }

  private assertValidVisibilityWindow(
    startsAt: Date,
    endsAt: Date | null,
  ): void {
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException(
        'Visibility label assignments must end after they start.',
      );
    }
  }

  private async assertVisibilityTargetExists(
    targetType: VisibilityTargetType,
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case VisibilityTargetType.BRAND: {
        const brand = await this.prisma.brand.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
          },
        });

        if (!brand) {
          throw new NotFoundException('Brand target not found.');
        }

        return;
      }
      case VisibilityTargetType.SERVICE: {
        const service = await this.prisma.service.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
          },
        });

        if (!service) {
          throw new NotFoundException('Service target not found.');
        }

        return;
      }
      case VisibilityTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          throw new NotFoundException('User target not found.');
        }

        return;
      }
      default:
        throw new BadRequestException('Unsupported visibility target.');
    }
  }

  private async assertNoOverlappingAssignment(
    targetType: VisibilityTargetType,
    labelId: string,
    targetId: string,
    startsAt: Date,
    endsAt: Date | null,
  ): Promise<void> {
    const periodEnd = endsAt ?? new Date('9999-12-31T23:59:59.999Z');
    const baseWhere = {
      labelId,
      startsAt: {
        lt: periodEnd,
      },
      OR: [
        {
          endsAt: null,
        },
        {
          endsAt: {
            gt: startsAt,
          },
        },
      ],
    };

    const existingAssignment =
      targetType === VisibilityTargetType.BRAND
        ? await this.prisma.brandVisibilityAssignment.findFirst({
            where: {
              ...baseWhere,
              brandId: targetId,
            },
            select: {
              id: true,
            },
          })
        : targetType === VisibilityTargetType.SERVICE
          ? await this.prisma.serviceVisibilityAssignment.findFirst({
              where: {
                ...baseWhere,
                serviceId: targetId,
              },
              select: {
                id: true,
              },
            })
          : await this.prisma.userVisibilityAssignment.findFirst({
              where: {
                ...baseWhere,
                userId: targetId,
              },
              select: {
                id: true,
              },
            });

    if (existingAssignment) {
      throw new ConflictException(
        'This target already has an overlapping assignment for the same visibility label.',
      );
    }
  }

  private async createVisibilityAssignment(
    tx: Prisma.TransactionClient,
    input: {
      targetType: VisibilityTargetType;
      labelId: string;
      targetId: string;
      createdByAdminId: string;
      startsAt: Date;
      endsAt: Date | null;
    },
  ): Promise<VisibilityAssignmentRecord> {
    switch (input.targetType) {
      case VisibilityTargetType.BRAND:
        return tx.brandVisibilityAssignment.create({
          data: {
            labelId: input.labelId,
            brandId: input.targetId,
            createdByAdminId: input.createdByAdminId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          },
        });
      case VisibilityTargetType.SERVICE:
        return tx.serviceVisibilityAssignment.create({
          data: {
            labelId: input.labelId,
            serviceId: input.targetId,
            createdByAdminId: input.createdByAdminId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          },
        });
      case VisibilityTargetType.USER:
        return tx.userVisibilityAssignment.create({
          data: {
            labelId: input.labelId,
            userId: input.targetId,
            createdByAdminId: input.createdByAdminId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          },
        });
      default:
        throw new BadRequestException('Unsupported visibility target.');
    }
  }

  private async findActiveVisibilityAssignment(
    targetType: VisibilityTargetType,
    labelId: string,
    targetId: string,
    at: Date,
  ): Promise<VisibilityAssignmentRecord | null> {
    const where = {
      labelId,
      startsAt: {
        lte: at,
      },
      OR: [
        {
          endsAt: null,
        },
        {
          endsAt: {
            gt: at,
          },
        },
      ],
    };

    switch (targetType) {
      case VisibilityTargetType.BRAND:
        return this.prisma.brandVisibilityAssignment.findFirst({
          where: {
            ...where,
            brandId: targetId,
          },
          orderBy: {
            startsAt: 'desc',
          },
        });
      case VisibilityTargetType.SERVICE:
        return this.prisma.serviceVisibilityAssignment.findFirst({
          where: {
            ...where,
            serviceId: targetId,
          },
          orderBy: {
            startsAt: 'desc',
          },
        });
      case VisibilityTargetType.USER:
        return this.prisma.userVisibilityAssignment.findFirst({
          where: {
            ...where,
            userId: targetId,
          },
          orderBy: {
            startsAt: 'desc',
          },
        });
      default:
        throw new BadRequestException('Unsupported visibility target.');
    }
  }

  private async endVisibilityAssignment(
    tx: Prisma.TransactionClient,
    input: {
      targetType: VisibilityTargetType;
      assignmentId: string;
      endsAt: Date;
    },
  ): Promise<VisibilityAssignmentRecord> {
    switch (input.targetType) {
      case VisibilityTargetType.BRAND:
        return tx.brandVisibilityAssignment.update({
          where: {
            id: input.assignmentId,
          },
          data: {
            endsAt: input.endsAt,
          },
        });
      case VisibilityTargetType.SERVICE:
        return tx.serviceVisibilityAssignment.update({
          where: {
            id: input.assignmentId,
          },
          data: {
            endsAt: input.endsAt,
          },
        });
      case VisibilityTargetType.USER:
        return tx.userVisibilityAssignment.update({
          where: {
            id: input.assignmentId,
          },
          data: {
            endsAt: input.endsAt,
          },
        });
      default:
        throw new BadRequestException('Unsupported visibility target.');
    }
  }

  private resolveVisibilityAssignmentAuditTarget(
    targetType: VisibilityTargetType,
  ): AdminAuditTargetType {
    switch (targetType) {
      case VisibilityTargetType.BRAND:
        return AdminAuditTargetType.BRAND_VISIBILITY_ASSIGNMENT;
      case VisibilityTargetType.SERVICE:
        return AdminAuditTargetType.SERVICE_VISIBILITY_ASSIGNMENT;
      case VisibilityTargetType.USER:
        return AdminAuditTargetType.USER_VISIBILITY_ASSIGNMENT;
      default:
        throw new BadRequestException('Unsupported visibility target.');
    }
  }

  private serializeReport(report: ReportRecord): Record<string, unknown> {
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      reporterUser: report.reporterUser,
      handledByAdmin: report.handledByAdmin,
    };
  }

  private serializeReservationObjection(
    objection: ReservationObjectionRecord,
  ): Record<string, unknown> {
    return {
      id: objection.id,
      objectionType: objection.objectionType,
      reason: objection.reason,
      status: objection.status,
      createdAt: objection.createdAt,
      resolvedAt: objection.resolvedAt,
      user: objection.user,
      reservation: objection.reservation,
      resolvedByAdmin: objection.resolvedByAdmin,
    };
  }

  private serializeVisibilityLabel(
    label: VisibilityLabelRecord,
  ): Record<string, unknown> {
    const assignmentCount =
      label.targetType === VisibilityTargetType.BRAND
        ? label._count.brandAssignments
        : label.targetType === VisibilityTargetType.SERVICE
          ? label._count.serviceAssignments
          : label._count.userAssignments;

    return {
      id: label.id,
      name: label.name,
      slug: label.slug,
      targetType: label.targetType,
      description: label.description,
      priority: label.priority,
      isActive: label.isActive,
      assignmentCount,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
    };
  }

  private serializeVisibilityAssignment(
    targetType: VisibilityTargetType,
    assignment: VisibilityAssignmentRecord,
    label: Pick<
      VisibilityLabel,
      'id' | 'name' | 'slug' | 'targetType' | 'priority'
    >,
  ): Record<string, unknown> {
    const targetId =
      'brandId' in assignment
        ? assignment.brandId
        : 'serviceId' in assignment
          ? assignment.serviceId
          : assignment.userId;

    return {
      id: assignment.id,
      targetType,
      targetId,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      label,
    };
  }

  private indexCounts(
    rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
  ): Record<string, number> {
    return rows.reduce<Record<string, number>>((accumulator, row) => {
      const entry =
        Object.entries(row).find(([entryKey]) => entryKey !== '_count') ?? [];
      const value = entry[1];

      if (typeof value === 'string') {
        accumulator[value] = row._count._all;
      }

      return accumulator;
    }, {});
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

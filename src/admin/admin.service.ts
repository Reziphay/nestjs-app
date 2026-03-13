import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditTargetType,
  BrandMembershipStatus,
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

import { isVisibilityAssignmentActive } from '../common/utils/visibility.util';
import { PenaltiesService } from '../penalties/penalties.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserActionDto } from './dto/admin-user-action.dto';
import { CreateSponsoredVisibilityDto } from './dto/create-sponsored-visibility.dto';
import { ListAdminActivityDto } from './dto/list-admin-activity.dto';
import { ListAdminBrandsDto } from './dto/list-admin-brands.dto';
import { ListAdminReservationObjectionsDto } from './dto/list-admin-reservation-objections.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
import { ListAdminServicesDto } from './dto/list-admin-services.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
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

type ReportTargetSummary =
  | {
      id: string;
      fullName: string;
      status: UserStatus;
      type: 'USER';
    }
  | {
      id: string;
      name: string;
      status: string;
      type: 'BRAND';
    }
  | {
      brand: {
        id: string;
        name: string;
      } | null;
      id: string;
      isActive: boolean;
      name: string;
      ownerUser: {
        id: string;
        fullName: string;
      };
      type: 'SERVICE';
    }
  | {
      comment: string;
      id: string;
      isDeleted: boolean;
      rating: number;
      type: 'REVIEW';
    };

type AnalyticsSnapshot = {
  users: Record<string, number>;
  brands: Record<string, number>;
  services: {
    total: number;
    active: number;
    inactive: number;
  };
  reservations: Record<string, number>;
  reports: Record<string, number>;
  reservationObjections: Record<string, number>;
  reviews: {
    total: number;
  };
  activeVisibilityAssignments: {
    brands: number;
    services: number;
    users: number;
  };
};

const activeVisibilityAssignmentInclude = {
  where: {
    label: {
      isActive: true,
    },
  },
  include: {
    label: {
      select: {
        id: true,
        name: true,
        slug: true,
        targetType: true,
        priority: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc' as const,
  },
};

const adminUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  suspendedUntil: true,
  closedReason: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: true,
    },
  },
  brandMemberships: {
    where: {
      status: BrandMembershipStatus.ACTIVE,
    },
    select: {
      brandId: true,
    },
  },
  services: {
    select: {
      id: true,
    },
  },
  visibilityAssignments: activeVisibilityAssignmentInclude,
} satisfies Prisma.UserSelect;

const adminBrandSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      fullName: true,
    },
  },
  memberships: {
    where: {
      status: BrandMembershipStatus.ACTIVE,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
  services: {
    select: {
      id: true,
      name: true,
      approvalMode: true,
    },
  },
  visibilityAssignments: activeVisibilityAssignmentInclude,
} satisfies Prisma.BrandSelect;

const adminServiceSelect = {
  id: true,
  name: true,
  description: true,
  approvalMode: true,
  waitingTimeMinutes: true,
  minAdvanceMinutes: true,
  maxAdvanceMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  ownerUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  visibilityAssignments: activeVisibilityAssignmentInclude,
} satisfies Prisma.ServiceSelect;

type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;

type AdminBrandRecord = Prisma.BrandGetPayload<{
  select: typeof adminBrandSelect;
}>;

type AdminServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof adminServiceSelect;
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  async getOverview(): Promise<Record<string, unknown>> {
    const [snapshot, activityResponse] = await Promise.all([
      this.getAnalyticsSnapshot(),
      this.listActivity({
        page: 1,
        pageSize: 6,
      }),
    ]);

    const activity = Array.isArray(activityResponse['items'])
      ? activityResponse['items']
      : [];

    return {
      kpis: [
        {
          label: 'Open reports',
          value: String(snapshot.reports['OPEN'] ?? 0),
          detail: `${snapshot.reports['UNDER_REVIEW'] ?? 0} currently under review`,
        },
        {
          label: 'Active users',
          value: String(snapshot.users['ACTIVE'] ?? 0),
          detail: `${snapshot.users['SUSPENDED'] ?? 0} suspended, ${snapshot.users['CLOSED'] ?? 0} closed`,
        },
        {
          label: 'Live services',
          value: String(snapshot.services.active),
          detail: `${snapshot.services.inactive} paused or inactive services`,
        },
        {
          label: 'Sponsored placements',
          value: String(snapshot.activeVisibilityAssignments.services),
          detail: `${snapshot.activeVisibilityAssignments.brands} featured brand placements live`,
        },
      ],
      activity,
    };
  }

  async listReports(
    query: ListAdminReportsDto,
  ): Promise<Record<string, unknown>> {
    const normalizedStatus = this.normalizeAdminReportStatus(query.status);
    const reports = await this.prisma.report.findMany({
      where: {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      include: reportInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const targetSummaryMap = await this.buildReportTargetSummaryMap(reports);
    const mappedReports = reports.map((report) =>
      this.serializeAdminReport(
        report,
        targetSummaryMap.get(
          this.getReportTargetSummaryKey(report.targetType, report.targetId),
        ) ?? null,
      ),
    );
    const filteredReports = this.filterByQuery(mappedReports, query.q, [
      'subject',
      'reason',
      'reporterLabel',
      'targetType',
      'status',
    ]);

    return this.paginateItems(filteredReports, {
      page: query.page,
      pageSize: query.pageSize,
      counts: this.countByKey(filteredReports, 'status'),
    });
  }

  async getReportDetail(reportId: string): Promise<Record<string, unknown>> {
    const report = await this.prisma.report.findUnique({
      where: {
        id: reportId,
      },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    const targetSummaryMap = await this.buildReportTargetSummaryMap([report]);
    const serializedReport = this.serializeAdminReport(
      report,
      targetSummaryMap.get(
        this.getReportTargetSummaryKey(report.targetType, report.targetId),
      ) ?? null,
    );
    const detail = await this.buildReportDetailRelations(report);

    return {
      ...serializedReport,
      report: serializedReport,
      ...detail,
    };
  }

  async applyReportAction(
    adminUserId: string,
    reportId: string,
    action: string,
    dto: ResolveReportDto,
  ): Promise<Record<string, unknown>> {
    const normalizedAction = action.trim().toLowerCase();

    if (normalizedAction === 'resolve') {
      return this.resolveReport(adminUserId, reportId, {
        ...dto,
        status: ReportStatus.RESOLVED,
      });
    }

    if (normalizedAction === 'dismiss') {
      return this.resolveReport(adminUserId, reportId, {
        ...dto,
        status: ReportStatus.DISMISSED,
      });
    }

    if (normalizedAction !== 'escalate') {
      throw new BadRequestException('Unsupported report action.');
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
      const escalatedReport = await tx.report.update({
        where: {
          id: report.id,
        },
        data: {
          status: ReportStatus.UNDER_REVIEW,
          handledByAdminId: adminUserId,
        },
        include: reportInclude,
      });

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'REPORT_ESCALATED',
        targetType: AdminAuditTargetType.REPORT,
        targetId: report.id,
        detailsJson: {
          note: dto.note?.trim() || null,
          previousStatus: report.status,
          status: ReportStatus.UNDER_REVIEW,
        },
      });

      return escalatedReport;
    });

    const targetSummaryMap = await this.buildReportTargetSummaryMap([
      updatedReport,
    ]);

    return {
      report: this.serializeAdminReport(
        updatedReport,
        targetSummaryMap.get(
          this.getReportTargetSummaryKey(
            updatedReport.targetType,
            updatedReport.targetId,
          ),
        ) ?? null,
      ),
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

  async listUsers(query: ListAdminUsersDto): Promise<Record<string, unknown>> {
    const users = await this.prisma.user.findMany({
      where: {
        ...(query.status
          ? {
              status: this.normalizeAdminUserStatus(query.status),
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                {
                  fullName: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  phone: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      select: adminUserSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const userRecords = await this.buildUserRecords(users);

    return this.paginateItems(userRecords, {
      page: query.page,
      pageSize: query.pageSize,
      counts: this.countByKey(userRecords, 'state'),
    });
  }

  async getUser(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: adminUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [serializedUser] = await this.buildUserRecords([user]);

    return serializedUser;
  }

  async getUserAdminDetail(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: adminUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [serializedUser] = await this.buildUserRecords([user]);
    const [brands, services, reports] = await Promise.all([
      this.prisma.brand.findMany({
        where: {
          memberships: {
            some: {
              userId,
              status: BrandMembershipStatus.ACTIVE,
            },
          },
        },
        select: adminBrandSelect,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.service.findMany({
        where: {
          ownerUserId: userId,
        },
        select: adminServiceSelect,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.report.findMany({
        where: {
          targetType: ReportTargetType.USER,
          targetId: userId,
        },
        include: reportInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const [serializedBrands, serializedServices] = await Promise.all([
      this.buildBrandRecords(brands),
      this.buildServiceRecords(services),
    ]);
    const reportSummaryMap = await this.buildReportTargetSummaryMap(reports);

    return {
      user: serializedUser,
      relatedBrands: serializedBrands,
      relatedServices: serializedServices,
      relatedReports: reports.map((report) =>
        this.serializeAdminReport(
          report,
          reportSummaryMap.get(
            this.getReportTargetSummaryKey(report.targetType, report.targetId),
          ) ?? null,
        ),
      ),
    };
  }

  async applyUserAction(
    adminUserId: string,
    targetUserId: string,
    action: string,
    dto: AdminUserActionDto,
  ): Promise<Record<string, unknown>> {
    const normalizedAction = action.trim().toLowerCase();

    if (normalizedAction === 'suspend') {
      return this.suspendUser(adminUserId, targetUserId, {
        durationDays: dto.durationDays ?? 30,
        reason: dto.reason?.trim() || 'Administrative suspension.',
      });
    }

    if (normalizedAction === 'close') {
      return this.closeUser(adminUserId, targetUserId, {
        reason: dto.reason?.trim() || 'Administrative closure.',
      });
    }

    if (normalizedAction !== 'reopen') {
      throw new BadRequestException('Unsupported user action.');
    }

    await this.assertModeratableUser(adminUserId, targetUserId);
    const now = new Date();

    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: targetUserId,
        },
        data: {
          status: UserStatus.ACTIVE,
          suspendedUntil: null,
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

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'USER_REOPENED',
        targetType: AdminAuditTargetType.USER,
        targetId: targetUserId,
        detailsJson: {
          reason: dto.reason?.trim() || null,
          reopenedAt: now,
        },
      });

      return updatedUser;
    });

    return {
      user,
    };
  }

  async listBrands(query: ListAdminBrandsDto): Promise<Record<string, unknown>> {
    const brands = await this.prisma.brand.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  owner: {
                    fullName: {
                      contains: query.q,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: adminBrandSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const brandRecords = await this.buildBrandRecords(brands);
    const filteredRecords =
      query.status === undefined
        ? brandRecords
        : brandRecords.filter((brand) => brand['status'] === query.status);

    return this.paginateItems(filteredRecords, {
      page: query.page,
      pageSize: query.pageSize,
      counts: this.countByKey(brandRecords, 'status'),
    });
  }

  async getBrand(brandId: string): Promise<Record<string, unknown>> {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
      select: adminBrandSelect,
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    const [serializedBrand] = await this.buildBrandRecords([brand]);

    return serializedBrand;
  }

  async getBrandAdminDetail(brandId: string): Promise<Record<string, unknown>> {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
      select: adminBrandSelect,
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    const [serializedBrand] = await this.buildBrandRecords([brand]);
    const [services, reports] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          brandId,
        },
        select: adminServiceSelect,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.report.findMany({
        where: {
          targetType: ReportTargetType.BRAND,
          targetId: brandId,
        },
        include: reportInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);
    const [serializedServices, reportSummaryMap] = await Promise.all([
      this.buildServiceRecords(services),
      this.buildReportTargetSummaryMap(reports),
    ]);

    return {
      brand: serializedBrand,
      relatedServices: serializedServices,
      relatedReports: reports.map((report) =>
        this.serializeAdminReport(
          report,
          reportSummaryMap.get(
            this.getReportTargetSummaryKey(report.targetType, report.targetId),
          ) ?? null,
        ),
      ),
    };
  }

  async listServices(
    query: ListAdminServicesDto,
  ): Promise<Record<string, unknown>> {
    const services = await this.prisma.service.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  ownerUser: {
                    fullName: {
                      contains: query.q,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  brand: {
                    name: {
                      contains: query.q,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: adminServiceSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const serviceRecords = await this.buildServiceRecords(services);
    const filteredRecords =
      query.status === undefined
        ? serviceRecords
        : serviceRecords.filter((service) => service['status'] === query.status);

    return this.paginateItems(filteredRecords, {
      page: query.page,
      pageSize: query.pageSize,
      counts: this.countByKey(serviceRecords, 'status'),
    });
  }

  async getService(serviceId: string): Promise<Record<string, unknown>> {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      select: adminServiceSelect,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const [serializedService] = await this.buildServiceRecords([service]);

    return serializedService;
  }

  async getServiceAdminDetail(
    serviceId: string,
  ): Promise<Record<string, unknown>> {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      select: adminServiceSelect,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const serializedService = this.buildServiceRecords([service])[0];

    const [reports, providerRecord, brandRecord] =
      await Promise.all([
        this.prisma.report.findMany({
          where: {
            targetType: ReportTargetType.SERVICE,
            targetId: serviceId,
          },
          include: reportInclude,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: service.ownerUser.id,
          },
          select: adminUserSelect,
        }),
        service.brand
          ? this.prisma.brand.findUnique({
              where: {
                id: service.brand.id,
              },
              select: adminBrandSelect,
            })
          : Promise.resolve(null),
      ]);

    const [serializedProvider] = providerRecord
      ? this.buildUserRecords([providerRecord])
      : [null];
    const [serializedBrand] = brandRecord
      ? this.buildBrandRecords([brandRecord])
      : [null];
    const reportSummaryMap = await this.buildReportTargetSummaryMap(reports);

    return {
      service: serializedService,
      relatedReports: reports.map((report) =>
        this.serializeAdminReport(
          report,
          reportSummaryMap.get(
            this.getReportTargetSummaryKey(report.targetType, report.targetId),
          ) ?? null,
        ),
      ),
      provider: serializedProvider,
      brand: serializedBrand,
    };
  }

  async listVisibilityLabels(
    query: ListVisibilityLabelsDto,
  ): Promise<Record<string, unknown>> {
    const [labels, assignments] = await Promise.all([
      this.prisma.visibilityLabel.findMany({
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
      }),
      this.listVisibilityAssignmentsForAdmin({}),
    ]);

    return {
      items: assignments,
      visibilityAssignments: assignments,
      labels: labels.map((label) => this.serializeVisibilityLabel(label)),
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

  async listSponsoredVisibility(): Promise<Record<string, unknown>> {
    const campaigns = await this.buildSponsoredVisibilityRecords();

    return {
      items: campaigns,
      campaigns,
    };
  }

  async createSponsoredVisibility(
    adminUserId: string,
    dto: CreateSponsoredVisibilityDto,
  ): Promise<Record<string, unknown>> {
    const targetType =
      dto.targetType === 'brand'
        ? VisibilityTargetType.BRAND
        : VisibilityTargetType.SERVICE;
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertValidVisibilityWindow(startsAt, endsAt);
    await this.assertVisibilityTargetExists(targetType, dto.targetId);

    const label = await this.findOrCreateSponsoredLabel(adminUserId, targetType);
    await this.assertNoOverlappingAssignment(
      targetType,
      label.id,
      dto.targetId,
      startsAt,
      endsAt,
    );

    const assignment = await this.prisma.$transaction(async (tx) => {
      const createdAssignment = await this.createVisibilityAssignment(tx, {
        targetType,
        labelId: label.id,
        targetId: dto.targetId,
        createdByAdminId: adminUserId,
        startsAt,
        endsAt,
      });

      await this.createAuditLog(tx, {
        actorUserId: adminUserId,
        action: 'SPONSORED_VISIBILITY_CREATED',
        targetType: this.resolveVisibilityAssignmentAuditTarget(targetType),
        targetId: createdAssignment.id,
        detailsJson: {
          campaignName: dto.campaignName.trim(),
          note: dto.note.trim(),
          labelId: label.id,
          targetId: dto.targetId,
          startsAt,
          endsAt,
          targetType: dto.targetType,
        },
      });

      return createdAssignment;
    });

    const [campaign] = await this.buildSponsoredVisibilityRecords([assignment.id]);

    return {
      campaign,
    };
  }

  async listActivity(
    query: ListAdminActivityDto,
  ): Promise<Record<string, unknown>> {
    const activityRecords = await this.buildActivityRecords();
    const filteredActivity =
      query.category === undefined
        ? activityRecords
        : activityRecords.filter((item) => item['category'] === query.category);
    const searchedActivity = this.filterByQuery(filteredActivity, query.q, [
      'title',
      'detail',
      'actor',
      'category',
    ]);

    return this.paginateItems(searchedActivity, {
      page: query.page,
      pageSize: query.pageSize,
      counts: this.countByKey(activityRecords, 'category'),
    });
  }

  async getAnalyticsOverview(): Promise<Array<Record<string, unknown>>> {
    const snapshot = await this.getAnalyticsSnapshot();

    return [
      {
        label: 'Reservations',
        values: [
          snapshot.reservations['PENDING'] ?? 0,
          snapshot.reservations['CONFIRMED'] ?? 0,
          snapshot.reservations['COMPLETED'] ?? 0,
          snapshot.reservations['NO_SHOW'] ?? 0,
        ],
      },
      {
        label: 'Moderation',
        values: [
          snapshot.reports['OPEN'] ?? 0,
          snapshot.reports['UNDER_REVIEW'] ?? 0,
          snapshot.reports['RESOLVED'] ?? 0,
          snapshot.reports['DISMISSED'] ?? 0,
        ],
      },
      {
        label: 'Visibility',
        values: [
          snapshot.activeVisibilityAssignments.brands,
          snapshot.activeVisibilityAssignments.services,
          snapshot.activeVisibilityAssignments.users,
          snapshot.reviews.total,
        ],
      },
    ];
  }

  private async getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
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

  private async buildReportTargetSummaryMap(
    reports: ReportRecord[],
  ): Promise<Map<string, ReportTargetSummary>> {
    const userIds = reports
      .filter((report) => report.targetType === ReportTargetType.USER)
      .map((report) => report.targetId);
    const brandIds = reports
      .filter((report) => report.targetType === ReportTargetType.BRAND)
      .map((report) => report.targetId);
    const serviceIds = reports
      .filter((report) => report.targetType === ReportTargetType.SERVICE)
      .map((report) => report.targetId);
    const reviewIds = reports
      .filter((report) => report.targetType === ReportTargetType.REVIEW)
      .map((report) => report.targetId);

    const [users, brands, services, reviews] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: {
              id: {
                in: userIds,
              },
            },
            select: {
              id: true,
              fullName: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      brandIds.length
        ? this.prisma.brand.findMany({
            where: {
              id: {
                in: brandIds,
              },
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      serviceIds.length
        ? this.prisma.service.findMany({
            where: {
              id: {
                in: serviceIds,
              },
            },
            select: {
              id: true,
              name: true,
              isActive: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                },
              },
              ownerUser: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      reviewIds.length
        ? this.prisma.review.findMany({
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
        : Promise.resolve([]),
    ]);

    const summaryEntries: Array<[string, ReportTargetSummary]> = [];

    users.forEach((user) => {
      summaryEntries.push([
        this.getReportTargetSummaryKey(ReportTargetType.USER, user.id),
        {
          id: user.id,
          fullName: user.fullName,
          status: user.status,
          type: 'USER',
        },
      ]);
    });

    brands.forEach((brand) => {
      summaryEntries.push([
        this.getReportTargetSummaryKey(ReportTargetType.BRAND, brand.id),
        {
          id: brand.id,
          name: brand.name,
          status: brand.status,
          type: 'BRAND',
        },
      ]);
    });

    services.forEach((service) => {
      summaryEntries.push([
        this.getReportTargetSummaryKey(ReportTargetType.SERVICE, service.id),
        {
          brand: service.brand,
          id: service.id,
          isActive: service.isActive,
          name: service.name,
          ownerUser: service.ownerUser,
          type: 'SERVICE',
        },
      ]);
    });

    reviews.forEach((review) => {
      summaryEntries.push([
        this.getReportTargetSummaryKey(ReportTargetType.REVIEW, review.id),
        {
          comment: review.comment,
          id: review.id,
          isDeleted: review.isDeleted,
          rating: review.rating,
          type: 'REVIEW',
        },
      ]);
    });

    return new Map(summaryEntries);
  }

  private getReportTargetSummaryKey(
    targetType: ReportTargetType,
    targetId: string,
  ): string {
    return `${targetType}:${targetId}`;
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

  private paginateItems<T>(
    items: T[],
    opts: { page?: number; pageSize?: number; counts?: Record<string, number> },
  ): Record<string, unknown> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const total = items.length;
    const pageCount = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      pageCount,
      ...(opts.counts ? { counts: opts.counts } : {}),
    };
  }

  private filterByQuery<T>(items: T[], query: string | undefined, keys: string[]): T[] {
    if (!query?.trim()) return items;
    const lowerQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      for (const key of keys) {
        const val = (item as any)[key];
        if (typeof val === 'string' && val.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      }
      return false;
    });
  }

  private countByKey<T>(items: T[], key: keyof T): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const val = item[key] as unknown as string;
      if (val) {
        counts[val] = (counts[val] ?? 0) + 1;
      }
    }
    return counts;
  }

  private buildUserRecords(
    users: AdminUserRecord[],
  ): Array<Record<string, unknown>> {
    return users.map((u) => ({
      ...u,
      state: u.status,
      roles: u.roles.map((r) => r.role),
      brandCount: u.brandMemberships?.length ?? 0,
      serviceCount: u.services?.length ?? 0,
    }));
  }

  private buildBrandRecords(
    brands: AdminBrandRecord[],
  ): Array<Record<string, unknown>> {
    return brands.map((b) => ({
      ...b,
      ownerName: b.owner?.fullName ?? null,
      memberCount: b.memberships?.length ?? 0,
      serviceCount: b.services?.length ?? 0,
    }));
  }

  private buildServiceRecords(
    services: AdminServiceRecord[],
  ): Array<Record<string, unknown>> {
    return services.map((s) => ({
      ...s,
      status: s.isActive ? 'ACTIVE' : 'INACTIVE',
      ownerName: s.ownerUser?.fullName ?? null,
      brandName: s.brand?.name ?? null,
      categoryName: s.category?.name ?? null,
    }));
  }

  private async buildActivityRecords(): Promise<Array<Record<string, unknown>>> {
    const [reports, objections, audits] = await Promise.all([
      this.prisma.report.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { reporterUser: true, handledByAdmin: true },
      }),
      this.prisma.reservationObjection.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { user: true, resolvedByAdmin: true },
      }),
      this.prisma.adminAuditLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { actorUser: true },
      }),
    ]);

    const activity: Array<Record<string, unknown> & { createdAt: Date; category: string }> = [
      ...reports.map((r) => ({
        id: `report-${r.id}`,
        title: `Report from ${r.reporterUser?.fullName}`,
        detail: r.reason,
        actor: r.reporterUser?.fullName,
        category: 'REPORT',
        createdAt: r.createdAt,
        status: r.status,
      })),
      ...objections.map((o) => ({
        id: `objection-${o.id}`,
        title: `Objection from ${o.user?.fullName}`,
        detail: o.reason,
        actor: o.user?.fullName,
        category: 'OBJECTION',
        createdAt: o.createdAt,
        status: o.status,
      })),
      ...audits.map((a) => ({
        id: `audit-${a.id}`,
        title: `Admin Action: ${a.action}`,
        detail: JSON.stringify(a.detailsJson ?? {}),
        actor: a.actorUser?.fullName,
        category: 'AUDIT',
        createdAt: a.createdAt,
      })),
    ];

    activity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return activity;
  }

  private async buildSponsoredVisibilityRecords(filterIds?: string[]): Promise<Array<Record<string, unknown>>> {
    const [brandAssignments, serviceAssignments] = await Promise.all([
      this.prisma.brandVisibilityAssignment.findMany({
        where: {
          label: { slug: 'sponsored', targetType: 'BRAND' },
          ...(filterIds && filterIds.length > 0 ? { id: { in: filterIds } } : {}),
        },
        include: { brand: true, label: true },
      }),
      this.prisma.serviceVisibilityAssignment.findMany({
        where: {
          label: { slug: 'sponsored', targetType: 'SERVICE' },
          ...(filterIds && filterIds.length > 0 ? { id: { in: filterIds } } : {}),
        },
        include: { service: true, label: true },
      }),
    ]);

    return [
      ...brandAssignments.map((a) => ({
        id: a.id,
        targetType: 'BRAND',
        targetId: a.brandId,
        targetName: a.brand?.name ?? 'Unknown target',
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        isActive: isVisibilityAssignmentActive(a.startsAt, a.endsAt),
      })),
      ...serviceAssignments.map((a) => ({
        id: a.id,
        targetType: 'SERVICE',
        targetId: a.serviceId,
        targetName: a.service?.name ?? 'Unknown target',
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        isActive: isVisibilityAssignmentActive(a.startsAt, a.endsAt),
      })),
    ].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  }

  private async buildReportDetailRelations(report: ReportRecord): Promise<Record<string, unknown>> {
    switch (report.targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            suspendedUntil: true,
            closedReason: true,
            createdAt: true,
            roles: { select: { role: true } },
          },
        });
        return user
          ? { targetUser: { ...user, roles: user.roles.map((r) => r.role) } }
          : {};
      }
      case ReportTargetType.BRAND: {
        const brand = await this.prisma.brand.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            owner: { select: { id: true, fullName: true } },
            _count: { select: { services: true, memberships: true } },
          },
        });
        return brand
          ? {
              targetBrand: {
                ...brand,
                ownerName: brand.owner?.fullName ?? null,
                serviceCount: brand._count.services,
                memberCount: brand._count.memberships,
              },
            }
          : {};
      }
      case ReportTargetType.SERVICE: {
        const service = await this.prisma.service.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            approvalMode: true,
            serviceType: true,
            createdAt: true,
            ownerUser: { select: { id: true, fullName: true } },
            brand: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        });
        return service
          ? {
              targetService: {
                ...service,
                ownerName: service.ownerUser?.fullName ?? null,
                brandName: service.brand?.name ?? null,
                categoryName: service.category?.name ?? null,
              },
            }
          : {};
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            rating: true,
            comment: true,
            isDeleted: true,
            createdAt: true,
            authorUser: { select: { id: true, fullName: true } },
            service: { select: { id: true, name: true } },
            reservation: { select: { id: true } },
          },
        });
        return review
          ? {
              targetReview: {
                ...review,
                authorName: review.authorUser?.fullName ?? null,
                serviceName: review.service?.name ?? null,
              },
            }
          : {};
      }
      default:
        return {};
    }
  }

  private serializeAdminReport(report: ReportRecord, targetSummary: ReportTargetSummary | null): Record<string, unknown> {
    const base = this.serializeReport(report);
    let subject = report.targetType as string;
    let reporterLabel = report.reporterUser?.email || report.reporterUser?.phone || 'Unknown';
    if (targetSummary) {
      if (targetSummary.type === 'USER') subject = targetSummary.fullName ?? subject;
      if (targetSummary.type === 'BRAND') subject = targetSummary.name ?? subject;
      if (targetSummary.type === 'SERVICE') subject = targetSummary.name ?? subject;
    }
    return {
      ...base,
      subject,
      reporterLabel,
      targetSummary,
    };
  }

  private normalizeAdminReportStatus(status?: string): ReportStatus | undefined {
    if (!status) return undefined;
    const up = status.toUpperCase() as ReportStatus;
    if (Object.values(ReportStatus).includes(up)) return up;
    return undefined;
  }

  private normalizeAdminUserStatus(status?: string): UserStatus | undefined {
    if (!status) return undefined;
    const up = status.toUpperCase() as UserStatus;
    if (Object.values(UserStatus).includes(up)) return up;
    return undefined;
  }

  private async listVisibilityAssignmentsForAdmin(
    query: { labelId?: string },
  ): Promise<Array<Record<string, unknown>>> {
    const [brands, services, users] = await Promise.all([
      this.prisma.brandVisibilityAssignment.findMany({
        where: query.labelId ? { labelId: query.labelId } : {},
        include: { label: true, brand: true },
      }),
      this.prisma.serviceVisibilityAssignment.findMany({
        where: query.labelId ? { labelId: query.labelId } : {},
        include: { label: true, service: true },
      }),
      this.prisma.userVisibilityAssignment.findMany({
        where: query.labelId ? { labelId: query.labelId } : {},
        include: { label: true, user: true },
      }),
    ]);

    const results: Array<Record<string, unknown> & { startsAt: Date }> = [
      ...brands.map((a) => ({
        ...this.serializeVisibilityAssignment(
          VisibilityTargetType.BRAND,
          a as unknown as VisibilityAssignmentRecord,
          a.label,
        ),
        targetName: a.brand?.name ?? 'Unknown',
        isActive: isVisibilityAssignmentActive(a.startsAt, a.endsAt),
        startsAt: a.startsAt,
      })),
      ...services.map((a) => ({
        ...this.serializeVisibilityAssignment(
          VisibilityTargetType.SERVICE,
          a as unknown as VisibilityAssignmentRecord,
          a.label,
        ),
        targetName: a.service?.name ?? 'Unknown',
        isActive: isVisibilityAssignmentActive(a.startsAt, a.endsAt),
        startsAt: a.startsAt,
      })),
      ...users.map((a) => ({
        ...this.serializeVisibilityAssignment(
          VisibilityTargetType.USER,
          a as unknown as VisibilityAssignmentRecord,
          a.label,
        ),
        targetName: a.user?.fullName ?? 'Unknown',
        isActive: isVisibilityAssignmentActive(a.startsAt, a.endsAt),
        startsAt: a.startsAt,
      })),
    ];

    return results.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  }

  private async findOrCreateSponsoredLabel(adminUserId: string, targetType: VisibilityTargetType): Promise<any> {
    let label = await this.prisma.visibilityLabel.findFirst({
      where: { targetType, slug: 'sponsored' },
    });
    if (!label) {
      label = await this.prisma.visibilityLabel.create({
        data: {
          name: 'Sponsored',
          slug: 'sponsored',
          targetType,
          description: 'Sponsored prominence assignment',
          priority: 100,
          isActive: true,
          createdByAdminId: adminUserId,
        },
      });
    }
    return label;
  }
}

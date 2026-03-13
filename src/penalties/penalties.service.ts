import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  PenaltyActionType,
  PenaltyReason,
  Prisma,
  ReservationActorType,
  ReservationObjectionStatus,
  ReservationObjectionType,
  ReservationStatus,
  UserStatus,
} from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationObjectionDto } from './dto/create-reservation-objection.dto';
import {
  AUTO_CLOSED_NO_SHOW_REASON,
  CLOSURE_THRESHOLD_POINTS,
  NO_SHOW_PENALTY_EXPIRY_MONTHS,
  NO_SHOW_PENALTY_POINTS,
  SUSPENSION_DURATION_MONTHS,
  SUSPENSION_THRESHOLD_POINTS,
} from './penalties.constants';

const noShowReservationInclude = {
  service: {
    select: {
      id: true,
      name: true,
      waitingTimeMinutes: true,
    },
  },
  customerUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
  serviceOwnerUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.ReservationInclude;

@Injectable()
export class PenaltiesService {
  private readonly logger = new Logger(PenaltiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listMyPenalties(userId: string): Promise<Record<string, unknown>> {
    const [penaltyPoints, penaltyActions, activePointsAggregate] =
      await Promise.all([
        this.prisma.penaltyPoint.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.penaltyAction.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.penaltyPoint.aggregate({
          where: {
            userId,
            isActive: true,
          },
          _sum: {
            points: true,
          },
        }),
      ]);

    return {
      activePoints: activePointsAggregate._sum.points ?? 0,
      points: penaltyPoints.map((point) => ({
        id: point.id,
        reservationId: point.reservationId,
        points: point.points,
        reason: point.reason,
        expiresAt: point.expiresAt,
        isActive: point.isActive,
        createdAt: point.createdAt,
      })),
      actions: penaltyActions.map((action) => ({
        id: action.id,
        triggeredByPoints: action.triggeredByPoints,
        action: action.action,
        startsAt: action.startsAt,
        endsAt: action.endsAt,
        isActive: action.isActive,
        createdAt: action.createdAt,
      })),
    };
  }

  async createReservationObjection(
    userId: string,
    reservationId: string,
    dto: CreateReservationObjectionDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);

    const reservation = await this.prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        customerUserId: true,
        status: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found.');
    }

    if (reservation.customerUserId !== userId) {
      throw new ForbiddenException(
        'Only the reservation customer can create an objection.',
      );
    }

    if (
      dto.objectionType === ReservationObjectionType.NO_SHOW_DISPUTE &&
      reservation.status !== ReservationStatus.NO_SHOW
    ) {
      throw new BadRequestException(
        'No-show disputes are only allowed for no-show reservations.',
      );
    }

    const existingPendingObjection =
      await this.prisma.reservationObjection.findFirst({
        where: {
          reservationId,
          userId,
          status: ReservationObjectionStatus.PENDING,
        },
        select: {
          id: true,
        },
      });

    if (existingPendingObjection) {
      throw new ConflictException(
        'This reservation already has a pending objection.',
      );
    }

    const objection = await this.prisma.reservationObjection.create({
      data: {
        reservationId,
        userId,
        objectionType: dto.objectionType,
        reason: dto.reason.trim(),
      },
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyObjectionReceived({
        objectionId: objection.id,
      }),
    );

    return {
      objection: {
        id: objection.id,
        reservationId: objection.reservationId,
        objectionType: objection.objectionType,
        reason: objection.reason,
        status: objection.status,
        createdAt: objection.createdAt,
      },
    };
  }

  async processNoShows(): Promise<Record<string, unknown>> {
    const now = new Date();
    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        requestedStartAt: {
          lte: now,
        },
      },
      include: noShowReservationInclude,
      orderBy: {
        requestedStartAt: 'asc',
      },
    });

    let processedCount = 0;

    for (const reservation of candidates) {
      if (
        reservation.requestedStartAt.getTime() +
          reservation.service.waitingTimeMinutes * 60_000 >
        now.getTime()
      ) {
        continue;
      }

      const outcome = await this.prisma.$transaction(async (tx) => {
        const currentReservation = await tx.reservation.findUnique({
          where: {
            id: reservation.id,
          },
          include: noShowReservationInclude,
        });

        if (!currentReservation) {
          return null;
        }

        if (currentReservation.status !== ReservationStatus.CONFIRMED) {
          return null;
        }

        if (
          currentReservation.requestedStartAt.getTime() +
            currentReservation.service.waitingTimeMinutes * 60_000 >
          now.getTime()
        ) {
          return null;
        }

        await tx.reservation.update({
          where: {
            id: currentReservation.id,
          },
          data: {
            status: ReservationStatus.NO_SHOW,
          },
        });

        await tx.reservationChangeRequest.updateMany({
          where: {
            reservationId: currentReservation.id,
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
            reviewedAt: now,
          },
        });

        await tx.reservationStatusHistory.create({
          data: {
            reservationId: currentReservation.id,
            fromStatus: ReservationStatus.CONFIRMED,
            toStatus: ReservationStatus.NO_SHOW,
            actorType: ReservationActorType.SYSTEM,
            actorUserId: null,
            reason: 'Reservation automatically marked as no-show.',
          },
        });

        await tx.penaltyPoint.upsert({
          where: {
            reservationId_reason: {
              reservationId: currentReservation.id,
              reason: PenaltyReason.NO_SHOW,
            },
          },
          update: {},
          create: {
            userId: currentReservation.customerUser.id,
            reservationId: currentReservation.id,
            points: NO_SHOW_PENALTY_POINTS,
            reason: PenaltyReason.NO_SHOW,
            expiresAt: this.addMonths(now, NO_SHOW_PENALTY_EXPIRY_MONTHS),
          },
        });

        const penaltyOutcome = await this.applyPenaltyConsequences(
          tx,
          currentReservation.customerUser.id,
          now,
        );

        return {
          reservationId: currentReservation.id,
          serviceName: currentReservation.service.name,
          customerUserId: currentReservation.customerUser.id,
          ownerUserId: currentReservation.serviceOwnerUser.id,
          activePoints: penaltyOutcome.activePoints,
          triggeredAction: penaltyOutcome.triggeredAction,
        };
      });

      if (!outcome) {
        continue;
      }

      processedCount += 1;
      await this.runNotificationSafely(() =>
        this.notificationsService.notifyReservationNoShow({
          reservationId: outcome.reservationId,
          recipientUserIds: [outcome.customerUserId, outcome.ownerUserId],
          serviceName: outcome.serviceName,
        }),
      );
      await this.runNotificationSafely(() =>
        this.notificationsService.notifyPenaltyApplied({
          userId: outcome.customerUserId,
          activePoints: outcome.activePoints,
          action: outcome.triggeredAction ?? undefined,
        }),
      );
    }

    return {
      processedCount,
    };
  }

  async cleanupExpiredPenaltyState(): Promise<Record<string, unknown>> {
    const now = new Date();
    const [expiredPoints, expiredSuspensions] = await Promise.all([
      this.prisma.penaltyPoint.findMany({
        where: {
          isActive: true,
          expiresAt: {
            lte: now,
          },
        },
        select: {
          userId: true,
        },
      }),
      this.prisma.penaltyAction.findMany({
        where: {
          isActive: true,
          action: PenaltyActionType.SUSPEND_1_MONTH,
          endsAt: {
            lte: now,
          },
        },
        select: {
          userId: true,
        },
      }),
    ]);

    const affectedUserIds = [
      ...new Set(
        [...expiredPoints, ...expiredSuspensions].map(
          (record) => record.userId,
        ),
      ),
    ];

    const [expiredPointsResult, expiredActionsResult] = await Promise.all([
      this.prisma.penaltyPoint.updateMany({
        where: {
          isActive: true,
          expiresAt: {
            lte: now,
          },
        },
        data: {
          isActive: false,
        },
      }),
      this.prisma.penaltyAction.updateMany({
        where: {
          isActive: true,
          action: PenaltyActionType.SUSPEND_1_MONTH,
          endsAt: {
            lte: now,
          },
        },
        data: {
          isActive: false,
        },
      }),
    ]);

    if (affectedUserIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const userId of affectedUserIds) {
          await this.reconcilePenaltyStateForUser(tx, userId, now);
        }
      });
    }

    return {
      expiredPointCount: expiredPointsResult.count,
      expiredActionCount: expiredActionsResult.count,
      affectedUsers: affectedUserIds.length,
    };
  }

  async recalculatePenaltyStateForUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.reconcilePenaltyStateForUser(tx, userId, new Date());
    });
  }

  private async applyPenaltyConsequences(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<{
    activePoints: number;
    triggeredAction: PenaltyActionType | null;
  }> {
    const [user, activePointsAggregate, activeCloseAction, activeSuspension] =
      await Promise.all([
        tx.user.findUniqueOrThrow({
          where: {
            id: userId,
          },
        }),
        tx.penaltyPoint.aggregate({
          where: {
            userId,
            isActive: true,
            expiresAt: {
              gt: now,
            },
          },
          _sum: {
            points: true,
          },
        }),
        tx.penaltyAction.findFirst({
          where: {
            userId,
            isActive: true,
            action: PenaltyActionType.CLOSE_INDEFINITELY,
          },
        }),
        tx.penaltyAction.findFirst({
          where: {
            userId,
            isActive: true,
            action: PenaltyActionType.SUSPEND_1_MONTH,
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

    const activePoints = activePointsAggregate._sum.points ?? 0;

    if (
      user.status === UserStatus.CLOSED &&
      user.closedReason &&
      user.closedReason !== AUTO_CLOSED_NO_SHOW_REASON
    ) {
      return {
        activePoints,
        triggeredAction: null,
      };
    }

    if (activePoints >= CLOSURE_THRESHOLD_POINTS) {
      if (!activeCloseAction) {
        await tx.penaltyAction.updateMany({
          where: {
            userId,
            isActive: true,
            action: PenaltyActionType.SUSPEND_1_MONTH,
          },
          data: {
            isActive: false,
          },
        });

        await tx.penaltyAction.create({
          data: {
            userId,
            triggeredByPoints: activePoints,
            action: PenaltyActionType.CLOSE_INDEFINITELY,
            startsAt: now,
            endsAt: null,
          },
        });
      }

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          status: UserStatus.CLOSED,
          suspendedUntil: null,
          closedReason: AUTO_CLOSED_NO_SHOW_REASON,
        },
      });
      await this.revokeActiveSessions(tx, userId, now);

      return {
        activePoints,
        triggeredAction: PenaltyActionType.CLOSE_INDEFINITELY,
      };
    }

    if (activePoints >= SUSPENSION_THRESHOLD_POINTS) {
      if (!activeSuspension) {
        const suspendedUntil = this.addMonths(now, SUSPENSION_DURATION_MONTHS);

        await tx.penaltyAction.create({
          data: {
            userId,
            triggeredByPoints: activePoints,
            action: PenaltyActionType.SUSPEND_1_MONTH,
            startsAt: now,
            endsAt: suspendedUntil,
          },
        });

        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            status: UserStatus.SUSPENDED,
            suspendedUntil,
            closedReason: null,
          },
        });
        await this.revokeActiveSessions(tx, userId, now);

        return {
          activePoints,
          triggeredAction: PenaltyActionType.SUSPEND_1_MONTH,
        };
      }

      return {
        activePoints,
        triggeredAction: null,
      };
    }

    return {
      activePoints,
      triggeredAction: null,
    };
  }

  private async reconcilePenaltyStateForUser(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    const [user, activeCloseAction, activeSuspension] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
      }),
      tx.penaltyAction.findFirst({
        where: {
          userId,
          isActive: true,
          action: PenaltyActionType.CLOSE_INDEFINITELY,
        },
      }),
      tx.penaltyAction.findFirst({
        where: {
          userId,
          isActive: true,
          action: PenaltyActionType.SUSPEND_1_MONTH,
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
        orderBy: {
          endsAt: 'desc',
        },
      }),
    ]);

    if (
      user.status === UserStatus.CLOSED &&
      user.closedReason &&
      user.closedReason !== AUTO_CLOSED_NO_SHOW_REASON
    ) {
      return;
    }

    if (activeCloseAction) {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          status: UserStatus.CLOSED,
          suspendedUntil: null,
          closedReason: AUTO_CLOSED_NO_SHOW_REASON,
        },
      });
      return;
    }

    if (activeSuspension) {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          status: UserStatus.SUSPENDED,
          suspendedUntil: activeSuspension.endsAt,
          closedReason: null,
        },
      });
      return;
    }

    if (
      user.status === UserStatus.SUSPENDED &&
      user.suspendedUntil &&
      user.suspendedUntil.getTime() > now.getTime()
    ) {
      return;
    }

    if (user.status !== UserStatus.CLOSED) {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          status: UserStatus.ACTIVE,
          suspendedUntil: null,
          closedReason:
            user.closedReason === AUTO_CLOSED_NO_SHOW_REASON
              ? null
              : user.closedReason,
        },
      });
    }
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

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
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
        'Notification dispatch failed during penalties flow.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

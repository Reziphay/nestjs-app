import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ApprovalMode,
  BrandStatus,
  Prisma,
  ReservationActorType,
  ReservationChangeRequestStatus,
  ReservationCompletionMethod,
  ReservationDelayStatus,
  ReservationStatus,
  ServiceType,
  UserStatus,
} from '@prisma/client';

import { AppRole } from '../common/enums/app-role.enum';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { NotificationPreferencesService } from '../notification-preferences/notification-preferences.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationPopularityStatsService } from '../discovery-stats/reservation-popularity-stats.service';
import { reservationConfig } from '../config';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsDto } from './dto/list-reservations.dto';
import {
  CancelReservationDto,
  CompleteReservationByQrDto,
  CreateReservationChangeRequestDto,
  RejectReservationDto,
  UpdateReservationDelayStatusDto,
} from './dto/reservation-actions.dto';
import { ReservationJobsService } from './reservation-jobs.service';
import {
  doReservationWindowsConflict,
  formatUtcTime,
  getDayOfWeekFromUtc,
  isReservationWindowInsideTimeRange,
  isSameUtcDate,
} from './reservation-time.util';
import {
  CHANGE_REQUESTABLE_RESERVATION_STATUSES,
  COMPLETABLE_RESERVATION_STATUSES,
  CUSTOMER_CANCELLABLE_RESERVATION_STATUSES,
  EXPIRABLE_RESERVATION_STATUSES,
  OWNER_CANCELLABLE_RESERVATION_STATUSES,
} from './reservations.constants';

const reservableServiceInclude = {
  brand: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  ownerUser: {
    select: {
      id: true,
      fullName: true,
    },
  },
  availabilityRules: {
    where: {
      isActive: true,
    },
    orderBy: [
      {
        dayOfWeek: 'asc',
      },
      {
        startTime: 'asc',
      },
    ],
  },
  availabilityExceptions: {
    orderBy: {
      date: 'asc',
    },
  },
  manualBlocks: {
    orderBy: {
      startsAt: 'asc',
    },
  },
} satisfies Prisma.ServiceInclude;

const reservationInclude = {
  service: {
    select: {
      id: true,
      name: true,
      approvalMode: true,
      serviceType: true,
      waitingTimeMinutes: true,
      freeCancellationDeadlineMinutes: true,
      priceAmount: true,
      priceCurrency: true,
      isActive: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
    },
  },
  customerUser: {
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  },
  serviceOwnerUser: {
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  },
  delayUpdates: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      updatedByUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      actorUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
  changeRequests: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      requestedByUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
      reviewedByUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
  completionRecords: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      completedByUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
      customerVerifiedUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.ReservationInclude;

type ReservableServiceRecord = Prisma.ServiceGetPayload<{
  include: typeof reservableServiceInclude;
}>;

type ReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

type ReservationParty = 'CUSTOMER' | 'OWNER';

type ReservationCompletionQrPayload = {
  sub: string;
  serviceId: string;
  ownerUserId: string;
  customerUserId: string;
  type: 'reservation-completion';
};

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationJobsService: ReservationJobsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly notificationsService: NotificationsService,
    private readonly reservationPopularityStatsService: ReservationPopularityStatsService,
    private readonly jwtService: JwtService,
    @Inject(reservationConfig.KEY)
    private readonly reservationConfiguration: ConfigType<
      typeof reservationConfig
    >,
  ) {}

  async listMyReservations(
    userId: string,
    query: ListReservationsDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        customerUserId: userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
      },
      include: reservationInclude,
      orderBy: [
        {
          requestedStartAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return {
      items: reservations.map((reservation) =>
        this.serializeReservation(reservation),
      ),
    };
  }

  async listIncomingReservations(
    userId: string,
    query: ListReservationsDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        serviceOwnerUserId: userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.customerUserId
          ? { customerUserId: query.customerUserId }
          : {}),
      },
      include: reservationInclude,
      orderBy: [
        {
          requestedStartAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return {
      items: reservations.map((reservation) =>
        this.serializeReservation(reservation),
      ),
    };
  }

  async getIncomingStats(userId: string): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);

    const counts = await this.prisma.reservation.groupBy({
      by: ['status'],
      where: { serviceOwnerUserId: userId },
      _count: { status: true },
    });

    const stats: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      rejected: 0,
      cancelledByCustomer: 0,
      cancelledByOwner: 0,
      total: 0,
    };

    for (const row of counts) {
      const key = row.status
        .toLowerCase()
        .replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
      stats[key] = (stats[key] ?? 0) + row._count.status;
      stats['total'] += row._count.status;
    }

    return stats;
  }

  async getReservation(
    user: Pick<AuthenticatedRequestUser, 'roles' | 'sub'>,
    reservationId: string,
  ): Promise<Record<string, unknown>> {
    const reservation = await this.getReservationForActorOrThrow(
      user.sub,
      reservationId,
      user.roles.includes(AppRole.ADMIN),
    );

    const completionQrPayload =
      reservation.serviceOwnerUser.id === user.sub
        ? await this.generateCompletionQrPayload(reservation)
        : null;

    return {
      reservation: this.serializeReservation(reservation, completionQrPayload),
    };
  }

  async createReservation(
    userId: string,
    dto: CreateReservationDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);
    await this.assertUserCanReserve(userId);

    const { requestedStartAt, requestedEndAt } = this.parseReservationWindow(
      dto.requestedStartAt,
      dto.requestedEndAt,
    );
    const service = await this.getReservableServiceOrThrow(dto.serviceId);

    if (service.ownerUserId === userId) {
      throw new ForbiddenException(
        'You cannot create a reservation for your own service.',
      );
    }

    this.assertLeadTimeConstraints(
      service,
      requestedStartAt,
      this.reservationConfiguration.approvalTtlMinutes,
    );
    this.assertReservationAvailability(
      service,
      requestedStartAt,
      requestedEndAt,
    );
    await this.assertNoSoloConflicts(
      service,
      requestedStartAt,
      requestedEndAt,
      null,
    );

    const initialStatus =
      service.approvalMode === ApprovalMode.MANUAL
        ? ReservationStatus.PENDING
        : ReservationStatus.CONFIRMED;
    const approvalExpiresAt =
      initialStatus === ReservationStatus.PENDING
        ? new Date(
            Date.now() +
              this.reservationConfiguration.approvalTtlMinutes * 60_000,
          )
        : null;

    const reservation = await this.prisma.$transaction(async (tx) => {
      const createdReservation = await tx.reservation.create({
        data: {
          serviceId: service.id,
          customerUserId: userId,
          serviceOwnerUserId: service.ownerUserId,
          brandId: service.brandId ?? null,
          requestedStartAt,
          requestedEndAt,
          status: initialStatus,
          approvalExpiresAt,
          customerNote: dto.customerNote?.trim() || null,
        },
      });

      await this.createStatusHistoryEntry(tx, {
        reservationId: createdReservation.id,
        fromStatus: null,
        toStatus: initialStatus,
        actorType: ReservationActorType.CUSTOMER,
        actorUserId: userId,
        reason:
          initialStatus === ReservationStatus.PENDING
            ? 'Reservation request created and awaiting owner response.'
            : 'Reservation auto-confirmed.',
      });
      await this.syncPopularityTransition(
        tx,
        createdReservation,
        null,
        initialStatus,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: createdReservation.id,
        },
        include: reservationInclude,
      });
    });

    if (approvalExpiresAt) {
      try {
        await this.reservationJobsService.schedulePendingExpiration(
          reservation.id,
          approvalExpiresAt,
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue expiration for reservation ${reservation.id}.`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.expirePendingReservation(reservation.id);
        throw new InternalServerErrorException(
          'Reservation request could not be queued for expiration handling.',
        );
      }
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      await this.scheduleUpcomingRemindersSafely(reservation);
    }

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationReceived({
        reservationId: reservation.id,
        ownerUserId: reservation.serviceOwnerUser.id,
        serviceName: reservation.service.name,
        customerName: reservation.customerUser.fullName,
      }),
    );

    if (reservation.status === ReservationStatus.CONFIRMED) {
      await this.runNotificationSafely(() =>
        this.notificationsService.notifyReservationConfirmed({
          reservationId: reservation.id,
          customerUserId: reservation.customerUser.id,
          serviceName: reservation.service.name,
        }),
      );
    }

    return {
      reservation: this.serializeReservation(reservation),
    };
  }

  async acceptReservation(
    userId: string,
    reservationId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);
    const reservation = await this.getOwnerReservationOrThrow(
      userId,
      reservationId,
    );
    await this.assertNotTimedOut(reservation);

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new ConflictException('Only pending reservations can be accepted.');
    }

    const service = await this.getReservableServiceOrThrow(
      reservation.service.id,
    );
    await this.assertNoSoloConflicts(
      service,
      reservation.requestedStartAt,
      reservation.requestedEndAt,
      reservation.id,
    );

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.CONFIRMED,
          approvalExpiresAt: null,
        },
      });

      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CONFIRMED,
        actorType: ReservationActorType.OWNER,
        actorUserId: userId,
        reason: 'Reservation accepted by owner.',
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        ReservationStatus.CONFIRMED,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.scheduleUpcomingRemindersSafely(updatedReservation);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationConfirmed({
        reservationId: updatedReservation.id,
        customerUserId: updatedReservation.customerUser.id,
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async rejectReservation(
    userId: string,
    reservationId: string,
    dto: RejectReservationDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);
    const reservation = await this.getOwnerReservationOrThrow(
      userId,
      reservationId,
    );
    await this.assertNotTimedOut(reservation);

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new ConflictException('Only pending reservations can be rejected.');
    }

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.REJECTED,
          rejectionReason: dto.reason.trim(),
          approvalExpiresAt: null,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.REJECTED,
        actorType: ReservationActorType.OWNER,
        actorUserId: userId,
        reason: dto.reason.trim(),
      });

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationRejected({
        reservationId: updatedReservation.id,
        customerUserId: updatedReservation.customerUser.id,
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async cancelByCustomer(
    userId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);
    const reservation = await this.getCustomerReservationOrThrow(
      userId,
      reservationId,
    );
    await this.assertNotTimedOut(reservation);

    if (
      !CUSTOMER_CANCELLABLE_RESERVATION_STATUSES.includes(reservation.status)
    ) {
      throw new ConflictException('This reservation cannot be cancelled.');
    }

    const freeCancellationEligible =
      reservation.service.freeCancellationDeadlineMinutes == null
        ? null
        : Date.now() <=
          reservation.requestedStartAt.getTime() -
            reservation.service.freeCancellationDeadlineMinutes * 60_000;

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.CANCELLED_BY_CUSTOMER,
          cancellationReason: dto.reason.trim(),
          freeCancellationEligibleAtCancellation: freeCancellationEligible,
          cancelledAt: new Date(),
          approvalExpiresAt: null,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CANCELLED_BY_CUSTOMER,
        actorType: ReservationActorType.CUSTOMER,
        actorUserId: userId,
        reason: dto.reason.trim(),
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        ReservationStatus.CANCELLED_BY_CUSTOMER,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.cancelUpcomingRemindersSafely(updatedReservation.id);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationCancelled({
        reservationId: updatedReservation.id,
        recipientUserIds: [updatedReservation.serviceOwnerUser.id],
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async cancelByOwner(
    userId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);
    const reservation = await this.getOwnerReservationOrThrow(
      userId,
      reservationId,
    );
    await this.assertNotTimedOut(reservation);

    if (!OWNER_CANCELLABLE_RESERVATION_STATUSES.includes(reservation.status)) {
      throw new ConflictException('This reservation cannot be cancelled.');
    }

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.CANCELLED_BY_OWNER,
          cancellationReason: dto.reason.trim(),
          cancelledAt: new Date(),
          approvalExpiresAt: null,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CANCELLED_BY_OWNER,
        actorType: ReservationActorType.OWNER,
        actorUserId: userId,
        reason: dto.reason.trim(),
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        ReservationStatus.CANCELLED_BY_OWNER,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.cancelUpcomingRemindersSafely(updatedReservation.id);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationCancelled({
        reservationId: updatedReservation.id,
        recipientUserIds: [updatedReservation.customerUser.id],
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async createChangeRequest(
    userId: string,
    reservationId: string,
    dto: CreateReservationChangeRequestDto,
  ): Promise<Record<string, unknown>> {
    const reservation = await this.getReservationForActorOrThrow(
      userId,
      reservationId,
      false,
    );
    await this.assertNotTimedOut(reservation);

    if (!CHANGE_REQUESTABLE_RESERVATION_STATUSES.includes(reservation.status)) {
      throw new ConflictException(
        'Change requests are only allowed for pending or confirmed reservations.',
      );
    }

    const existingPendingChangeRequest =
      await this.prisma.reservationChangeRequest.findFirst({
        where: {
          reservationId: reservation.id,
          status: ReservationChangeRequestStatus.PENDING,
        },
        select: {
          id: true,
        },
      });

    if (existingPendingChangeRequest) {
      throw new ConflictException(
        'This reservation already has a pending change request.',
      );
    }

    const service = await this.getReservableServiceOrThrow(
      reservation.service.id,
    );
    const { requestedStartAt, requestedEndAt } = this.parseReservationWindow(
      dto.requestedStartAt,
      dto.requestedEndAt,
    );

    this.assertLeadTimeConstraints(
      service,
      requestedStartAt,
      this.reservationConfiguration.approvalTtlMinutes,
    );
    this.assertReservationAvailability(
      service,
      requestedStartAt,
      requestedEndAt,
    );
    await this.assertNoSoloConflicts(
      service,
      requestedStartAt,
      requestedEndAt,
      reservation.id,
    );

    const actorParty = this.getReservationParty(reservation, userId);
    await this.assertRole(
      userId,
      actorParty === 'CUSTOMER' ? AppRole.UCR : AppRole.USO,
    );
    const nextStatus =
      actorParty === 'CUSTOMER'
        ? ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER
        : ReservationStatus.CHANGE_REQUESTED_BY_OWNER;

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservationChangeRequest.create({
        data: {
          reservationId: reservation.id,
          requestedByUserId: userId,
          requestedStartAt,
          requestedEndAt,
          reason: dto.reason.trim(),
          previousStatus: reservation.status,
        },
      });

      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: nextStatus,
        },
      });

      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: nextStatus,
        actorType:
          actorParty === 'CUSTOMER'
            ? ReservationActorType.CUSTOMER
            : ReservationActorType.OWNER,
        actorUserId: userId,
        reason: dto.reason.trim(),
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        nextStatus,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationChangeRequested({
        reservationId: updatedReservation.id,
        recipientUserIds: [
          actorParty === 'CUSTOMER'
            ? updatedReservation.serviceOwnerUser.id
            : updatedReservation.customerUser.id,
        ],
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async acceptChangeRequest(
    userId: string,
    changeRequestId: string,
  ): Promise<Record<string, unknown>> {
    const changeRequest =
      await this.getPendingChangeRequestOrThrow(changeRequestId);
    const reservation = await this.getReservationForActorOrThrow(
      userId,
      changeRequest.reservationId,
      false,
    );
    await this.assertNotTimedOut(reservation);

    if (changeRequest.requestedByUserId === userId) {
      throw new ForbiddenException(
        'You cannot accept a change request you created.',
      );
    }

    const service = await this.getReservableServiceOrThrow(
      reservation.service.id,
    );
    const reviewerParty = this.getReservationParty(reservation, userId);
    await this.assertRole(
      userId,
      reviewerParty === 'CUSTOMER' ? AppRole.UCR : AppRole.USO,
    );
    this.assertReservationAvailability(
      service,
      changeRequest.requestedStartAt,
      changeRequest.requestedEndAt,
    );
    await this.assertNoSoloConflicts(
      service,
      changeRequest.requestedStartAt,
      changeRequest.requestedEndAt,
      reservation.id,
    );
    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservationChangeRequest.update({
        where: {
          id: changeRequest.id,
        },
        data: {
          status: ReservationChangeRequestStatus.ACCEPTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          requestedStartAt: changeRequest.requestedStartAt,
          requestedEndAt: changeRequest.requestedEndAt,
          status: ReservationStatus.CONFIRMED,
          approvalExpiresAt: null,
          delayStatus: ReservationDelayStatus.NONE,
          estimatedArrivalMinutes: null,
          delayNote: null,
          delayStatusUpdatedAt: null,
          arrivedAt: null,
        },
      });

      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CONFIRMED,
        actorType:
          reviewerParty === 'CUSTOMER'
            ? ReservationActorType.CUSTOMER
            : ReservationActorType.OWNER,
        actorUserId: userId,
        reason: 'Reservation change request accepted.',
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        ReservationStatus.CONFIRMED,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.cancelUpcomingRemindersSafely(updatedReservation.id);
    await this.scheduleUpcomingRemindersSafely(updatedReservation);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationConfirmed({
        reservationId: updatedReservation.id,
        customerUserId: updatedReservation.customerUser.id,
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async rejectChangeRequest(
    userId: string,
    changeRequestId: string,
  ): Promise<Record<string, unknown>> {
    const changeRequest =
      await this.getPendingChangeRequestOrThrow(changeRequestId);
    const reservation = await this.getReservationForActorOrThrow(
      userId,
      changeRequest.reservationId,
      false,
    );
    await this.assertNotTimedOut(reservation);

    if (changeRequest.requestedByUserId === userId) {
      throw new ForbiddenException(
        'You cannot reject a change request you created.',
      );
    }

    const reviewerParty = this.getReservationParty(reservation, userId);
    await this.assertRole(
      userId,
      reviewerParty === 'CUSTOMER' ? AppRole.UCR : AppRole.USO,
    );
    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservationChangeRequest.update({
        where: {
          id: changeRequest.id,
        },
        data: {
          status: ReservationChangeRequestStatus.REJECTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: changeRequest.previousStatus,
        },
      });

      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: changeRequest.previousStatus,
        actorType:
          reviewerParty === 'CUSTOMER'
            ? ReservationActorType.CUSTOMER
            : ReservationActorType.OWNER,
        actorUserId: userId,
        reason: 'Reservation change request rejected.',
      });
      await this.syncPopularityTransition(
        tx,
        reservation,
        reservation.status,
        changeRequest.previousStatus,
      );

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async updateDelayStatus(
    userId: string,
    reservationId: string,
    dto: UpdateReservationDelayStatusDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);

    const reservation = await this.getCustomerReservationOrThrow(
      userId,
      reservationId,
    );

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(
        'Delay status can only be updated for confirmed reservations.',
      );
    }

    if (
      dto.status === ReservationDelayStatus.ARRIVED &&
      dto.estimatedArrivalMinutes != null
    ) {
      throw new BadRequestException(
        'Estimated arrival minutes are only allowed when reporting a delay.',
      );
    }

    if (reservation.delayStatus === ReservationDelayStatus.ARRIVED) {
      throw new ConflictException('Arrival has already been recorded.');
    }

    const note = dto.note?.trim() || null;
    const estimatedArrivalMinutes =
      dto.status === ReservationDelayStatus.RUNNING_LATE
        ? (dto.estimatedArrivalMinutes ?? null)
        : null;
    const now = new Date();

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          delayStatus: dto.status,
          estimatedArrivalMinutes,
          delayNote: note,
          delayStatusUpdatedAt: now,
          arrivedAt:
            dto.status === ReservationDelayStatus.ARRIVED
              ? (reservation.arrivedAt ?? now)
              : null,
        },
      });

      await tx.reservationDelayUpdate.create({
        data: {
          reservationId: reservation.id,
          status: dto.status,
          estimatedArrivalMinutes,
          note,
          updatedByUserId: userId,
        },
      });

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationDelayUpdated({
        reservationId: updatedReservation.id,
        ownerUserId: updatedReservation.serviceOwnerUser.id,
        serviceName: updatedReservation.service.name,
        customerName: updatedReservation.customerUser.fullName,
        status: dto.status,
        estimatedArrivalMinutes,
        note,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async completeManually(
    userId: string,
    reservationId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.USO);
    const reservation = await this.getOwnerReservationOrThrow(
      userId,
      reservationId,
    );

    if (!COMPLETABLE_RESERVATION_STATUSES.includes(reservation.status)) {
      throw new ConflictException(
        'Only confirmed reservations can be completed.',
      );
    }

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.COMPLETED,
          completedAt: new Date(),
          approvalExpiresAt: null,
        },
      });

      await tx.reservationCompletionRecord.create({
        data: {
          reservationId: reservation.id,
          method: ReservationCompletionMethod.MANUAL,
          completedByUserId: userId,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.COMPLETED,
        actorType: ReservationActorType.OWNER,
        actorUserId: userId,
        reason: 'Reservation completed manually by owner.',
      });

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.cancelUpcomingRemindersSafely(updatedReservation.id);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationCompleted({
        reservationId: updatedReservation.id,
        recipientUserIds: [
          updatedReservation.customerUser.id,
          updatedReservation.serviceOwnerUser.id,
        ],
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async completeByQr(
    userId: string,
    reservationId: string,
    dto: CompleteReservationByQrDto,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(userId, AppRole.UCR);
    const reservation = await this.getCustomerReservationOrThrow(
      userId,
      reservationId,
    );

    if (!COMPLETABLE_RESERVATION_STATUSES.includes(reservation.status)) {
      throw new ConflictException(
        'Only confirmed reservations can be completed.',
      );
    }

    const payload = await this.verifyCompletionQrPayload(dto.qrPayload);

    if (
      payload.sub !== reservation.id ||
      payload.serviceId !== reservation.service.id ||
      payload.ownerUserId !== reservation.serviceOwnerUser.id ||
      payload.customerUserId !== userId
    ) {
      throw new BadRequestException('The provided QR payload is invalid.');
    }

    const updatedReservation = await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.COMPLETED,
          completedAt: new Date(),
          approvalExpiresAt: null,
        },
      });

      await tx.reservationCompletionRecord.create({
        data: {
          reservationId: reservation.id,
          method: ReservationCompletionMethod.QR,
          completedByUserId: reservation.serviceOwnerUser.id,
          customerVerifiedUserId: userId,
          qrPayloadSnapshot: dto.qrPayload,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.COMPLETED,
        actorType: ReservationActorType.CUSTOMER,
        actorUserId: userId,
        reason: 'Reservation completed by signed QR verification.',
      });

      return tx.reservation.findUniqueOrThrow({
        where: {
          id: reservation.id,
        },
        include: reservationInclude,
      });
    });

    await this.cancelUpcomingRemindersSafely(updatedReservation.id);

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationCompleted({
        reservationId: updatedReservation.id,
        recipientUserIds: [
          updatedReservation.customerUser.id,
          updatedReservation.serviceOwnerUser.id,
        ],
        serviceName: updatedReservation.service.name,
      }),
    );

    return {
      reservation: this.serializeReservation(updatedReservation),
    };
  }

  async expirePendingReservation(reservationId: string): Promise<void> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: {
          id: reservationId,
        },
      });

      if (!reservation) {
        return null;
      }

      if (!EXPIRABLE_RESERVATION_STATUSES.includes(reservation.status)) {
        return null;
      }

      if (
        reservation.approvalExpiresAt &&
        reservation.approvalExpiresAt.getTime() > Date.now()
      ) {
        return null;
      }

      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: ReservationStatus.EXPIRED,
          approvalExpiresAt: null,
        },
      });

      await this.cancelPendingChangeRequests(tx, reservation.id);
      await this.createStatusHistoryEntry(tx, {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.EXPIRED,
        actorType: ReservationActorType.SYSTEM,
        actorUserId: null,
        reason:
          'Reservation request expired after the approval window elapsed.',
      });

      return {
        reservationId: reservation.id,
        customerUserId: reservation.customerUserId,
        ownerUserId: reservation.serviceOwnerUserId,
        serviceName:
          (
            await tx.service.findUnique({
              where: {
                id: reservation.serviceId,
              },
              select: {
                name: true,
              },
            })
          )?.name ?? 'Reservation',
      };
    });

    if (!outcome) {
      return;
    }

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationExpired({
        reservationId: outcome.reservationId,
        recipientUserIds: [outcome.customerUserId, outcome.ownerUserId],
        serviceName: outcome.serviceName,
      }),
    );
  }

  async sendUpcomingReminder(
    reservationId: string,
    leadMinutes: number,
    scheduledStartAtIso: string,
  ): Promise<void> {
    if (!Number.isInteger(leadMinutes) || leadMinutes < 1) {
      this.logger.warn(
        `Skipping reservation reminder for ${reservationId} because the lead time is invalid.`,
      );
      return;
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },
      include: reservationInclude,
    });

    if (!reservation || reservation.status !== ReservationStatus.CONFIRMED) {
      return;
    }

    if (
      scheduledStartAtIso &&
      reservation.requestedStartAt.toISOString() !== scheduledStartAtIso
    ) {
      return;
    }

    if (reservation.requestedStartAt.getTime() <= Date.now()) {
      return;
    }

    await this.runNotificationSafely(() =>
      this.notificationsService.notifyReservationReminder({
        reservationId: reservation.id,
        recipientUserIds: [
          reservation.customerUser.id,
          reservation.serviceOwnerUser.id,
        ],
        serviceName: reservation.service.name,
        startsAt: reservation.requestedStartAt,
        leadMinutes,
      }),
    );
  }

  private async getReservableServiceOrThrow(
    serviceId: string,
  ): Promise<ReservableServiceRecord> {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      include: reservableServiceInclude,
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found.');
    }

    if (service.brand && service.brand.status !== BrandStatus.ACTIVE) {
      throw new BadRequestException(
        'This service cannot currently accept reservations.',
      );
    }

    return service;
  }

  private async getReservationForActorOrThrow(
    userId: string,
    reservationId: string,
    isAdmin = false,
  ): Promise<ReservationRecord> {
    const reservation = await this.prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },
      include: reservationInclude,
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found.');
    }

    if (
      !isAdmin &&
      reservation.customerUser.id !== userId &&
      reservation.serviceOwnerUser.id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this reservation.',
      );
    }

    return reservation;
  }

  private async getCustomerReservationOrThrow(
    userId: string,
    reservationId: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.getReservationForActorOrThrow(
      userId,
      reservationId,
      false,
    );

    if (reservation.customerUser.id !== userId) {
      throw new ForbiddenException(
        'Only the customer can perform this action.',
      );
    }

    return reservation;
  }

  private async getOwnerReservationOrThrow(
    userId: string,
    reservationId: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.getReservationForActorOrThrow(
      userId,
      reservationId,
      false,
    );

    if (reservation.serviceOwnerUser.id !== userId) {
      throw new ForbiddenException('Only the service owner can do this.');
    }

    return reservation;
  }

  private async getPendingChangeRequestOrThrow(changeRequestId: string) {
    const changeRequest = await this.prisma.reservationChangeRequest.findFirst({
      where: {
        id: changeRequestId,
        status: ReservationChangeRequestStatus.PENDING,
      },
    });

    if (!changeRequest) {
      throw new NotFoundException(
        'Pending reservation change request not found.',
      );
    }

    return changeRequest;
  }

  private parseReservationWindow(
    requestedStartAtInput: string,
    requestedEndAtInput?: string,
  ): {
    requestedStartAt: Date;
    requestedEndAt: Date | null;
  } {
    const requestedStartAt = new Date(requestedStartAtInput);

    if (Number.isNaN(requestedStartAt.getTime())) {
      throw new BadRequestException('Reservation start time is invalid.');
    }

    if (requestedStartAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Reservation start time must be in the future.',
      );
    }

    const requestedEndAt = requestedEndAtInput
      ? new Date(requestedEndAtInput)
      : null;

    if (requestedEndAt && Number.isNaN(requestedEndAt.getTime())) {
      throw new BadRequestException('Reservation end time is invalid.');
    }

    if (
      requestedEndAt &&
      requestedEndAt.getTime() <= requestedStartAt.getTime()
    ) {
      throw new BadRequestException(
        'Reservation end time must be after the start time.',
      );
    }

    if (requestedEndAt && !isSameUtcDate(requestedStartAt, requestedEndAt)) {
      throw new BadRequestException(
        'Reservation times must remain within a single day in Phase 3.',
      );
    }

    return {
      requestedStartAt,
      requestedEndAt,
    };
  }

  private assertLeadTimeConstraints(
    service: ReservableServiceRecord,
    requestedStartAt: Date,
    approvalTtlMinutes: number,
  ): void {
    const leadTimeMinutes = (requestedStartAt.getTime() - Date.now()) / 60_000;

    if (
      service.minAdvanceMinutes != null &&
      leadTimeMinutes < service.minAdvanceMinutes
    ) {
      throw new BadRequestException(
        'This service requires more advance notice for reservations.',
      );
    }

    if (
      service.maxAdvanceMinutes != null &&
      leadTimeMinutes > service.maxAdvanceMinutes
    ) {
      throw new BadRequestException(
        'This reservation is too far in the future for this service.',
      );
    }

    if (
      service.approvalMode === ApprovalMode.MANUAL &&
      leadTimeMinutes < approvalTtlMinutes
    ) {
      throw new BadRequestException(
        'Manual approval reservations must leave enough time for review.',
      );
    }
  }

  private assertReservationAvailability(
    service: ReservableServiceRecord,
    requestedStartAt: Date,
    requestedEndAt: Date | null,
  ): void {
    const overlappingManualBlock = service.manualBlocks.find((manualBlock) =>
      doReservationWindowsConflict(
        requestedStartAt,
        requestedEndAt,
        manualBlock.startsAt,
        manualBlock.endsAt,
      ),
    );

    if (overlappingManualBlock) {
      throw new BadRequestException(
        'The requested time falls inside a manual service block.',
      );
    }

    const startTime = formatUtcTime(requestedStartAt);
    const endTime = requestedEndAt ? formatUtcTime(requestedEndAt) : null;
    const matchingException = service.availabilityExceptions.find((exception) =>
      isSameUtcDate(exception.date, requestedStartAt),
    );

    if (matchingException) {
      if (matchingException.isClosedAllDay) {
        throw new BadRequestException(
          'The service is not available on the requested date.',
        );
      }

      if (
        !matchingException.startTime ||
        !matchingException.endTime ||
        !isReservationWindowInsideTimeRange(
          startTime,
          endTime,
          matchingException.startTime,
          matchingException.endTime,
        )
      ) {
        throw new BadRequestException(
          'The requested time falls outside the service availability.',
        );
      }

      return;
    }

    const matchingRules = service.availabilityRules.filter(
      (rule) => rule.dayOfWeek === getDayOfWeekFromUtc(requestedStartAt),
    );

    if (matchingRules.length === 0) {
      throw new BadRequestException(
        'The service is not available on the requested day.',
      );
    }

    const isInsideAnyRule = matchingRules.some((rule) =>
      isReservationWindowInsideTimeRange(
        startTime,
        endTime,
        rule.startTime,
        rule.endTime,
      ),
    );

    if (!isInsideAnyRule) {
      throw new BadRequestException(
        'The requested time falls outside the service availability.',
      );
    }
  }

  private async assertNoSoloConflicts(
    service: Pick<ReservableServiceRecord, 'id' | 'serviceType'>,
    requestedStartAt: Date,
    requestedEndAt: Date | null,
    excludeReservationId: string | null,
  ): Promise<void> {
    if (service.serviceType !== ServiceType.SOLO) {
      return;
    }

    const confirmedReservations = await this.prisma.reservation.findMany({
      where: {
        serviceId: service.id,
        status: ReservationStatus.CONFIRMED,
        ...(excludeReservationId
          ? {
              id: {
                not: excludeReservationId,
              },
            }
          : {}),
      },
      select: {
        id: true,
        requestedStartAt: true,
        requestedEndAt: true,
      },
    });

    const hasConflict = confirmedReservations.some((reservation) =>
      doReservationWindowsConflict(
        requestedStartAt,
        requestedEndAt,
        reservation.requestedStartAt,
        reservation.requestedEndAt,
      ),
    );

    if (hasConflict) {
      throw new ConflictException(
        'The requested reservation time is no longer available.',
      );
    }
  }

  private async assertNotTimedOut(
    reservation: Pick<ReservationRecord, 'approvalExpiresAt' | 'id' | 'status'>,
  ): Promise<void> {
    if (
      reservation.approvalExpiresAt &&
      EXPIRABLE_RESERVATION_STATUSES.includes(reservation.status) &&
      reservation.approvalExpiresAt.getTime() <= Date.now()
    ) {
      await this.expirePendingReservation(reservation.id);
      throw new ConflictException(
        'This reservation request has already expired.',
      );
    }
  }

  private getReservationParty(
    reservation: Pick<ReservationRecord, 'customerUser' | 'serviceOwnerUser'>,
    userId: string,
  ): ReservationParty {
    if (reservation.customerUser.id === userId) {
      return 'CUSTOMER';
    }

    if (reservation.serviceOwnerUser.id === userId) {
      return 'OWNER';
    }

    throw new ForbiddenException('You do not have access to this reservation.');
  }

  private async generateCompletionQrPayload(
    reservation: ReservationRecord,
  ): Promise<string | null> {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      return null;
    }

    return this.jwtService.signAsync(
      {
        sub: reservation.id,
        serviceId: reservation.service.id,
        ownerUserId: reservation.serviceOwnerUser.id,
        customerUserId: reservation.customerUser.id,
        type: 'reservation-completion',
      } satisfies ReservationCompletionQrPayload,
      {
        secret: this.reservationConfiguration.qrSecret,
        expiresIn: `${this.reservationConfiguration.qrTtlMinutes}m`,
      },
    );
  }

  private async verifyCompletionQrPayload(
    qrPayload: string,
  ): Promise<ReservationCompletionQrPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<ReservationCompletionQrPayload>(
          qrPayload,
          {
            secret: this.reservationConfiguration.qrSecret,
          },
        );

      if (payload.type !== 'reservation-completion') {
        throw new BadRequestException('The provided QR payload is invalid.');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('The provided QR payload is invalid.');
    }
  }

  private async createStatusHistoryEntry(
    tx: Prisma.TransactionClient,
    data: {
      reservationId: string;
      fromStatus: ReservationStatus | null;
      toStatus: ReservationStatus;
      reason: string;
      actorType: ReservationActorType;
      actorUserId: string | null;
    },
  ): Promise<void> {
    await tx.reservationStatusHistory.create({
      data,
    });
  }

  private async syncPopularityTransition(
    tx: Prisma.TransactionClient,
    reservation: {
      serviceId: string;
      serviceOwnerUserId: string;
      brandId: string | null;
    },
    fromStatus: ReservationStatus | null,
    toStatus: ReservationStatus,
  ): Promise<void> {
    await this.reservationPopularityStatsService.syncReservationTransition(tx, {
      serviceId: reservation.serviceId,
      serviceOwnerUserId: reservation.serviceOwnerUserId,
      brandId: reservation.brandId,
      fromStatus,
      toStatus,
    });
  }

  private async cancelPendingChangeRequests(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ): Promise<void> {
    await tx.reservationChangeRequest.updateMany({
      where: {
        reservationId,
        status: ReservationChangeRequestStatus.PENDING,
      },
      data: {
        status: ReservationChangeRequestStatus.CANCELLED,
        reviewedAt: new Date(),
      },
    });
  }

  private async assertRole(userId: string, role: AppRole): Promise<void> {
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
    });

    if (!userRole) {
      throw new ForbiddenException(`This action requires the ${role} role.`);
    }
  }

  private async assertUserCanReserve(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account cannot create reservations right now.',
      );
    }
  }

  private serializeReservation(
    reservation: ReservationRecord,
    completionQrPayload: string | null = null,
  ): Record<string, unknown> {
    return {
      id: reservation.id,
      status: reservation.status,
      requestedStartAt: reservation.requestedStartAt,
      requestedEndAt: reservation.requestedEndAt,
      approvalExpiresAt: reservation.approvalExpiresAt,
      delay: {
        status: reservation.delayStatus,
        estimatedArrivalMinutes: reservation.estimatedArrivalMinutes,
        note: reservation.delayNote,
        updatedAt: reservation.delayStatusUpdatedAt,
        arrivedAt: reservation.arrivedAt,
      },
      customerNote: reservation.customerNote,
      rejectionReason: reservation.rejectionReason,
      cancellationReason: reservation.cancellationReason,
      freeCancellationEligibleAtCancellation:
        reservation.freeCancellationEligibleAtCancellation,
      cancelledAt: reservation.cancelledAt,
      completedAt: reservation.completedAt,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
      service: reservation.service,
      brand: reservation.brand,
      customer: reservation.customerUser,
      owner: reservation.serviceOwnerUser,
      changeRequests: reservation.changeRequests.map((changeRequest) => ({
        id: changeRequest.id,
        requestedStartAt: changeRequest.requestedStartAt,
        requestedEndAt: changeRequest.requestedEndAt,
        reason: changeRequest.reason,
        status: changeRequest.status,
        previousStatus: changeRequest.previousStatus,
        reviewedAt: changeRequest.reviewedAt,
        createdAt: changeRequest.createdAt,
        updatedAt: changeRequest.updatedAt,
        requestedByUser: changeRequest.requestedByUser,
        reviewedByUser: changeRequest.reviewedByUser,
      })),
      delayHistory: (reservation.delayUpdates ?? []).map((delayUpdate) => ({
        id: delayUpdate.id,
        status: delayUpdate.status,
        estimatedArrivalMinutes: delayUpdate.estimatedArrivalMinutes,
        note: delayUpdate.note,
        updatedByUser: delayUpdate.updatedByUser,
        createdAt: delayUpdate.createdAt,
      })),
      statusHistory: reservation.statusHistory.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        actorType: entry.actorType,
        actorUser: entry.actorUser,
        createdAt: entry.createdAt,
      })),
      completionRecords: reservation.completionRecords.map((record) => ({
        id: record.id,
        method: record.method,
        completedByUser: record.completedByUser,
        customerVerifiedUser: record.customerVerifiedUser,
        createdAt: record.createdAt,
      })),
      completionQrPayload,
    };
  }

  private async runNotificationSafely(
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error(
        'Notification dispatch failed during reservations flow.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async scheduleUpcomingRemindersSafely(
    reservation: Pick<
      ReservationRecord,
      'customerUser' | 'id' | 'requestedStartAt' | 'status'
    >,
  ): Promise<void> {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      return;
    }

    try {
      const notificationSettings =
        await this.notificationPreferencesService.getResolvedNotificationSettings(
          reservation.customerUser.id,
        );

      if (!notificationSettings.upcomingAppointmentReminders.enabled) {
        return;
      }

      await this.reservationJobsService.scheduleUpcomingReminders(
        reservation.id,
        reservation.requestedStartAt,
        notificationSettings.upcomingAppointmentReminders.leadMinutes,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule upcoming reminders for reservation ${reservation.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async cancelUpcomingRemindersSafely(
    reservationId: string,
  ): Promise<void> {
    try {
      await this.reservationJobsService.cancelUpcomingReminders(reservationId);
    } catch (error) {
      this.logger.error(
        `Failed to cancel upcoming reminders for reservation ${reservationId}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

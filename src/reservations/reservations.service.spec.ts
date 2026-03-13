/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  ApprovalMode,
  ReservationCompletionMethod,
  ReservationStatus,
  ServiceType,
  UserStatus,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

import { ReservationsService } from './reservations.service';

const reservationConfig = {
  approvalTtlMinutes: 5,
  qrSecret: 'test-qr-secret',
  qrTtlMinutes: 10,
};

describe('ReservationsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a manual reservation request and schedules expiration', async () => {
    const requestedStartAt = '2026-03-16T10:00:00.000Z';
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'customer-1',
      role: 'UCR',
    });
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'customer-1',
      status: UserStatus.ACTIVE,
    });
    const serviceFindUnique = jest.fn().mockResolvedValue({
      id: 'service-1',
      ownerUserId: 'owner-1',
      brandId: null,
      minAdvanceMinutes: 60,
      maxAdvanceMinutes: 60 * 24 * 30,
      approvalMode: ApprovalMode.MANUAL,
      serviceType: ServiceType.SOLO,
      isActive: true,
      brand: null,
      ownerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
      },
      availabilityRules: [
        {
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '18:00',
          isActive: true,
        },
      ],
      availabilityExceptions: [],
    });
    const reservationFindMany = jest.fn().mockResolvedValue([]);
    const reservationCreate = jest.fn().mockResolvedValue({
      id: 'reservation-1',
    });
    const reservationStatusHistoryCreate = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.PENDING,
      requestedStartAt: new Date(requestedStartAt),
      requestedEndAt: null,
      approvalExpiresAt: new Date('2026-03-13T08:05:00.000Z'),
      customerNote: 'Please confirm soon',
      rejectionReason: null,
      cancellationReason: null,
      freeCancellationEligibleAtCancellation: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: new Date('2026-03-13T08:00:00.000Z'),
      updatedAt: new Date('2026-03-13T08:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        approvalMode: ApprovalMode.MANUAL,
        serviceType: ServiceType.SOLO,
        waitingTimeMinutes: 15,
        freeCancellationDeadlineMinutes: 120,
        priceAmount: 25,
        priceCurrency: 'AZN',
        isActive: true,
      },
      brand: null,
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        phone: '+10000000002',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
        phone: '+10000000003',
      },
      changeRequests: [],
      statusHistory: [],
      completionRecords: [],
    });
    const schedulePendingExpiration = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      user: {
        findUnique: userFindUnique,
      },
      service: {
        findUnique: serviceFindUnique,
      },
      reservation: {
        findMany: reservationFindMany,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservation: {
                create: reservationCreate,
                findUniqueOrThrow: reservationFindUniqueOrThrow,
              },
              reservationStatusHistory: {
                create: reservationStatusHistoryCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new ReservationsService(
      prisma,
      {
        schedulePendingExpiration,
      } as any,
      new JwtService(),
      reservationConfig as any,
    );

    const result = await service.createReservation('customer-1', {
      serviceId: 'service-1',
      requestedStartAt,
      customerNote: 'Please confirm soon',
    });

    expect(reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: 'service-1',
        customerUserId: 'customer-1',
        serviceOwnerUserId: 'owner-1',
        status: ReservationStatus.PENDING,
      }),
    });
    expect(schedulePendingExpiration).toHaveBeenCalledWith(
      'reservation-1',
      expect.any(Date),
    );
    expect(result).toEqual(
      expect.objectContaining({
        reservation: expect.objectContaining({
          id: 'reservation-1',
          status: ReservationStatus.PENDING,
        }),
      }),
    );
  });

  it('allows the owner to accept a pending reservation', async () => {
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'owner-1',
      role: 'USO',
    });
    const reservationFindUnique = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.PENDING,
      requestedStartAt: new Date('2026-03-16T10:00:00.000Z'),
      requestedEndAt: null,
      approvalExpiresAt: new Date('2026-03-13T08:05:00.000Z'),
      customerNote: null,
      rejectionReason: null,
      cancellationReason: null,
      freeCancellationEligibleAtCancellation: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: new Date('2026-03-13T08:00:00.000Z'),
      updatedAt: new Date('2026-03-13T08:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        approvalMode: ApprovalMode.MANUAL,
        serviceType: ServiceType.SOLO,
        waitingTimeMinutes: 15,
        freeCancellationDeadlineMinutes: 120,
        priceAmount: 25,
        priceCurrency: 'AZN',
        isActive: true,
      },
      brand: null,
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        phone: '+10000000002',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
        phone: '+10000000003',
      },
      changeRequests: [],
      statusHistory: [],
      completionRecords: [],
    });
    const serviceFindUnique = jest.fn().mockResolvedValue({
      id: 'service-1',
      ownerUserId: 'owner-1',
      brandId: null,
      minAdvanceMinutes: 60,
      maxAdvanceMinutes: 60 * 24 * 30,
      approvalMode: ApprovalMode.MANUAL,
      serviceType: ServiceType.SOLO,
      isActive: true,
      brand: null,
      ownerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
      },
      availabilityRules: [],
      availabilityExceptions: [],
    });
    const reservationFindMany = jest.fn().mockResolvedValue([]);
    const reservationUpdate = jest.fn().mockResolvedValue(undefined);
    const reservationStatusHistoryCreate = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      requestedStartAt: new Date('2026-03-16T10:00:00.000Z'),
      requestedEndAt: null,
      approvalExpiresAt: null,
      customerNote: null,
      rejectionReason: null,
      cancellationReason: null,
      freeCancellationEligibleAtCancellation: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: new Date('2026-03-13T08:00:00.000Z'),
      updatedAt: new Date('2026-03-13T08:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        approvalMode: ApprovalMode.MANUAL,
        serviceType: ServiceType.SOLO,
        waitingTimeMinutes: 15,
        freeCancellationDeadlineMinutes: 120,
        priceAmount: 25,
        priceCurrency: 'AZN',
        isActive: true,
      },
      brand: null,
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        phone: '+10000000002',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
        phone: '+10000000003',
      },
      changeRequests: [],
      statusHistory: [],
      completionRecords: [],
    });

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      service: {
        findUnique: serviceFindUnique,
      },
      reservation: {
        findUnique: reservationFindUnique,
        findMany: reservationFindMany,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservation: {
                update: reservationUpdate,
                findUniqueOrThrow: reservationFindUniqueOrThrow,
              },
              reservationStatusHistory: {
                create: reservationStatusHistoryCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new ReservationsService(
      prisma,
      {} as any,
      new JwtService(),
      reservationConfig as any,
    );

    const result = await service.acceptReservation('owner-1', 'reservation-1');

    expect(reservationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
      },
      data: {
        status: ReservationStatus.CONFIRMED,
        approvalExpiresAt: null,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        reservation: expect.objectContaining({
          status: ReservationStatus.CONFIRMED,
        }),
      }),
    );
  });

  it('completes a confirmed reservation by signed QR payload', async () => {
    jest.useRealTimers();

    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'customer-1',
      role: 'UCR',
    });
    const reservationRecord = {
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      requestedStartAt: new Date('2026-03-16T10:00:00.000Z'),
      requestedEndAt: null,
      approvalExpiresAt: null,
      customerNote: null,
      rejectionReason: null,
      cancellationReason: null,
      freeCancellationEligibleAtCancellation: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: new Date('2026-03-13T08:00:00.000Z'),
      updatedAt: new Date('2026-03-13T08:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        approvalMode: ApprovalMode.MANUAL,
        serviceType: ServiceType.SOLO,
        waitingTimeMinutes: 15,
        freeCancellationDeadlineMinutes: 120,
        priceAmount: 25,
        priceCurrency: 'AZN',
        isActive: true,
      },
      brand: null,
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        phone: '+10000000002',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
        phone: '+10000000003',
      },
      changeRequests: [],
      statusHistory: [],
      completionRecords: [],
    };
    const reservationFindUnique = jest
      .fn()
      .mockResolvedValue(reservationRecord);
    const reservationUpdate = jest.fn().mockResolvedValue(undefined);
    const reservationCompletionRecordCreate = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationChangeRequestUpdateMany = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationStatusHistoryCreate = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationFindUniqueOrThrow = jest.fn().mockResolvedValue({
      ...reservationRecord,
      status: ReservationStatus.COMPLETED,
      completedAt: new Date('2026-03-13T08:01:00.000Z'),
      completionRecords: [
        {
          id: 'completion-1',
          method: ReservationCompletionMethod.QR,
          completedByUser: {
            id: 'owner-1',
            fullName: 'Demo Owner',
          },
          customerVerifiedUser: {
            id: 'customer-1',
            fullName: 'Demo Customer',
          },
          createdAt: new Date('2026-03-13T08:01:00.000Z'),
        },
      ],
    });
    const jwtService = new JwtService();
    const qrPayload = jwtService.sign(
      {
        sub: 'reservation-1',
        serviceId: 'service-1',
        ownerUserId: 'owner-1',
        customerUserId: 'customer-1',
        type: 'reservation-completion',
      },
      {
        secret: reservationConfig.qrSecret,
        expiresIn: '10m',
      },
    );

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      reservation: {
        findUnique: reservationFindUnique,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservation: {
                update: reservationUpdate,
                findUniqueOrThrow: reservationFindUniqueOrThrow,
              },
              reservationCompletionRecord: {
                create: reservationCompletionRecordCreate,
              },
              reservationChangeRequest: {
                updateMany: reservationChangeRequestUpdateMany,
              },
              reservationStatusHistory: {
                create: reservationStatusHistoryCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new ReservationsService(
      prisma,
      {} as any,
      jwtService,
      reservationConfig as any,
    );

    const result = await service.completeByQr('customer-1', 'reservation-1', {
      qrPayload,
    });

    expect(reservationCompletionRecordCreate).toHaveBeenCalledWith({
      data: {
        reservationId: 'reservation-1',
        method: ReservationCompletionMethod.QR,
        completedByUserId: 'owner-1',
        customerVerifiedUserId: 'customer-1',
        qrPayloadSnapshot: qrPayload,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        reservation: expect.objectContaining({
          status: ReservationStatus.COMPLETED,
        }),
      }),
    );
  });

  it('expires a timed-out manual reservation idempotently', async () => {
    const reservationFindUnique = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.PENDING,
      approvalExpiresAt: new Date('2026-03-13T07:55:00.000Z'),
    });
    const reservationUpdate = jest.fn().mockResolvedValue(undefined);
    const reservationChangeRequestUpdateMany = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationStatusHistoryCreate = jest
      .fn()
      .mockResolvedValue(undefined);

    const prisma = {
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservation: {
                findUnique: reservationFindUnique,
                update: reservationUpdate,
              },
              reservationChangeRequest: {
                updateMany: reservationChangeRequestUpdateMany,
              },
              reservationStatusHistory: {
                create: reservationStatusHistoryCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new ReservationsService(
      prisma,
      {} as any,
      new JwtService(),
      reservationConfig as any,
    );

    await service.expirePendingReservation('reservation-1');

    expect(reservationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
      },
      data: {
        status: ReservationStatus.EXPIRED,
        approvalExpiresAt: null,
      },
    });
    expect(reservationStatusHistoryCreate).toHaveBeenCalled();
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  ReportTargetType,
  ReservationObjectionStatus,
  ReservationObjectionType,
  ReservationStatus,
} from '@prisma/client';

import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('hydrates service target summaries when listing reports', async () => {
    const reportFindMany = jest.fn().mockResolvedValue([
      {
        id: 'report-1',
        targetType: ReportTargetType.SERVICE,
        targetId: 'service-1',
        reason: 'Misleading service info.',
        status: 'OPEN',
        createdAt: new Date('2026-03-13T11:00:00.000Z'),
        resolvedAt: null,
        reporterUser: {
          id: 'customer-1',
          fullName: 'Demo Customer',
          email: 'customer@reziphay.local',
          phone: '+10000000002',
        },
        handledByAdmin: null,
      },
    ]);
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-1',
        name: 'Classic Haircut',
        isActive: true,
        brand: {
          id: 'brand-1',
          name: 'Studio Reziphay',
        },
        ownerUser: {
          id: 'owner-1',
          fullName: 'Demo Owner',
        },
      },
    ]);

    const service = new AdminService(
      {
        report: {
          findMany: reportFindMany,
        },
        user: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        brand: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        service: {
          findMany: serviceFindMany,
        },
        review: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as any,
      {} as any,
    );

    const result = await service.listReports({});

    expect(serviceFindMany).toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'report-1',
          targetSummary: {
            type: ReportTargetType.SERVICE,
            id: 'service-1',
            name: 'Classic Haircut',
            isActive: true,
            brand: {
              id: 'brand-1',
              name: 'Studio Reziphay',
            },
            ownerUser: {
              id: 'owner-1',
              fullName: 'Demo Owner',
            },
          },
        }),
      ],
    });
  });

  it('accepts a reservation objection and recalculates penalty state', async () => {
    const objectionFindUnique = jest.fn().mockResolvedValue({
      id: 'objection-1',
      reservationId: 'reservation-1',
      userId: 'customer-1',
      objectionType: ReservationObjectionType.NO_SHOW_DISPUTE,
      reason: 'The provider never showed up.',
      status: ReservationObjectionStatus.PENDING,
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
      resolvedAt: null,
      user: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        email: 'customer@reziphay.local',
        phone: '+10000000002',
      },
      reservation: {
        id: 'reservation-1',
        status: ReservationStatus.NO_SHOW,
        requestedStartAt: new Date('2026-03-13T09:00:00.000Z'),
        service: {
          id: 'service-1',
          name: 'Classic Haircut',
        },
      },
      resolvedByAdmin: null,
    });
    const objectionUpdate = jest.fn().mockResolvedValue({
      id: 'objection-1',
      reservationId: 'reservation-1',
      userId: 'customer-1',
      objectionType: ReservationObjectionType.NO_SHOW_DISPUTE,
      reason: 'The provider never showed up.',
      status: ReservationObjectionStatus.ACCEPTED,
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
      resolvedAt: new Date('2026-03-13T11:00:00.000Z'),
      user: {
        id: 'customer-1',
        fullName: 'Demo Customer',
        email: 'customer@reziphay.local',
        phone: '+10000000002',
      },
      reservation: {
        id: 'reservation-1',
        status: ReservationStatus.NO_SHOW,
        requestedStartAt: new Date('2026-03-13T09:00:00.000Z'),
        service: {
          id: 'service-1',
          name: 'Classic Haircut',
        },
      },
      resolvedByAdmin: {
        id: 'admin-1',
        fullName: 'Reziphay Admin',
      },
    });
    const penaltyPointUpdateMany = jest.fn().mockResolvedValue({
      count: 1,
    });
    const adminAuditLogCreate = jest.fn().mockResolvedValue(undefined);
    const recalculatePenaltyStateForUser = jest
      .fn()
      .mockResolvedValue(undefined);

    const prisma = {
      reservationObjection: {
        findUnique: objectionFindUnique,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservationObjection: {
                update: objectionUpdate,
              },
              penaltyPoint: {
                updateMany: penaltyPointUpdateMany,
              },
              adminAuditLog: {
                create: adminAuditLogCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new AdminService(prisma, {
      recalculatePenaltyStateForUser,
    } as any);

    const result = await service.resolveReservationObjection(
      'admin-1',
      'objection-1',
      {
        status: ReservationObjectionStatus.ACCEPTED,
        note: 'Penalty removed after review.',
      },
    );

    expect(objectionUpdate).toHaveBeenCalled();
    expect(penaltyPointUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'customer-1',
        reservationId: 'reservation-1',
        reason: 'NO_SHOW',
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    expect(adminAuditLogCreate).toHaveBeenCalled();
    expect(recalculatePenaltyStateForUser).toHaveBeenCalledWith('customer-1');
    expect(result).toEqual(
      expect.objectContaining({
        deactivatedPenaltyPoints: 1,
        objection: expect.objectContaining({
          id: 'objection-1',
          status: ReservationObjectionStatus.ACCEPTED,
        }),
      }),
    );
  });
});

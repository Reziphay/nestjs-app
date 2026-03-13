/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  ReservationDelayStatus,
  ReservationStatus,
  UserStatus,
} from '@prisma/client';

import { PenaltiesService } from './penalties.service';

describe('PenaltiesService', () => {
  it('marks overdue confirmed reservations as no-show and creates a penalty point', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-20T10:30:00.000Z'));

    const reservationFindMany = jest.fn().mockResolvedValue([
      {
        id: 'reservation-1',
        status: ReservationStatus.CONFIRMED,
        delayStatus: ReservationDelayStatus.NONE,
        requestedStartAt: new Date('2026-03-20T10:00:00.000Z'),
        service: {
          id: 'service-1',
          name: 'Classic Haircut',
          waitingTimeMinutes: 15,
        },
        customerUser: {
          id: 'customer-1',
          fullName: 'Demo Customer',
        },
        serviceOwnerUser: {
          id: 'owner-1',
          fullName: 'Demo Owner',
        },
      },
    ]);
    const currentReservation = {
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      delayStatus: ReservationDelayStatus.NONE,
      requestedStartAt: new Date('2026-03-20T10:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        waitingTimeMinutes: 15,
      },
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
      },
    };
    const reservationFindUnique = jest
      .fn()
      .mockResolvedValue(currentReservation);
    const reservationUpdate = jest.fn().mockResolvedValue(undefined);
    const reservationChangeRequestUpdateMany = jest
      .fn()
      .mockResolvedValue(undefined);
    const reservationStatusHistoryCreate = jest
      .fn()
      .mockResolvedValue(undefined);
    const penaltyPointUpsert = jest.fn().mockResolvedValue(undefined);
    const userFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'customer-1',
      status: UserStatus.ACTIVE,
      closedReason: null,
    });
    const penaltyPointAggregate = jest.fn().mockResolvedValue({
      _sum: {
        points: 1,
      },
    });
    const penaltyActionFindFirst = jest.fn().mockResolvedValue(null);
    const notifyReservationNoShow = jest.fn().mockResolvedValue(undefined);
    const notifyPenaltyApplied = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      reservation: {
        findMany: reservationFindMany,
      },
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
              penaltyPoint: {
                upsert: penaltyPointUpsert,
                aggregate: penaltyPointAggregate,
              },
              penaltyAction: {
                findFirst: penaltyActionFindFirst,
              },
              user: {
                findUniqueOrThrow: userFindUniqueOrThrow,
              },
            }),
          ),
      ),
    } as any;

    const service = new PenaltiesService(prisma, {
      notifyReservationNoShow,
      notifyPenaltyApplied,
    } as any);

    const result = await service.processNoShows();

    expect(reservationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
      },
      data: {
        status: ReservationStatus.NO_SHOW,
      },
    });
    expect(penaltyPointUpsert).toHaveBeenCalled();
    expect(notifyReservationNoShow).toHaveBeenCalled();
    expect(notifyPenaltyApplied).toHaveBeenCalledWith({
      userId: 'customer-1',
      activePoints: 1,
      action: undefined,
    });
    expect(result).toEqual({
      processedCount: 1,
    });

    jest.useRealTimers();
  });

  it('skips reservations already marked as arrived when processing no-shows', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-20T10:30:00.000Z'));

    const reservationFindMany = jest.fn().mockResolvedValue([
      {
        id: 'reservation-1',
        status: ReservationStatus.CONFIRMED,
        delayStatus: ReservationDelayStatus.ARRIVED,
        requestedStartAt: new Date('2026-03-20T10:00:00.000Z'),
        service: {
          id: 'service-1',
          name: 'Classic Haircut',
          waitingTimeMinutes: 15,
        },
        customerUser: {
          id: 'customer-1',
          fullName: 'Demo Customer',
        },
        serviceOwnerUser: {
          id: 'owner-1',
          fullName: 'Demo Owner',
        },
      },
    ]);
    const reservationFindUnique = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      delayStatus: ReservationDelayStatus.ARRIVED,
      requestedStartAt: new Date('2026-03-20T10:00:00.000Z'),
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
        waitingTimeMinutes: 15,
      },
      customerUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
      },
    });
    const reservationUpdate = jest.fn();

    const prisma = {
      reservation: {
        findMany: reservationFindMany,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              reservation: {
                findUnique: reservationFindUnique,
                update: reservationUpdate,
              },
            }),
          ),
      ),
    } as any;

    const service = new PenaltiesService(prisma, {
      notifyReservationNoShow: jest.fn(),
      notifyPenaltyApplied: jest.fn(),
    } as any);

    const result = await service.processNoShows();

    expect(reservationUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      processedCount: 0,
    });

    jest.useRealTimers();
  });
});

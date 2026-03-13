/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { ReservationStatus } from '@prisma/client';

import { ReservationPopularityStatsService } from './reservation-popularity-stats.service';

describe('ReservationPopularityStatsService', () => {
  it('creates popularity stats when a reservation becomes popularity-eligible', async () => {
    const service = new ReservationPopularityStatsService();
    const tx = {
      servicePopularityStat: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      serviceOwnerPopularityStat: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      brandPopularityStat: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    await service.syncReservationTransition(tx, {
      serviceId: 'service-1',
      serviceOwnerUserId: 'owner-1',
      brandId: 'brand-1',
      fromStatus: ReservationStatus.PENDING,
      toStatus: ReservationStatus.CONFIRMED,
    });

    expect(tx.servicePopularityStat.create).toHaveBeenCalledWith({
      data: {
        serviceId: 'service-1',
        popularityScore: 1,
      },
    });
    expect(tx.serviceOwnerPopularityStat.create).toHaveBeenCalledWith({
      data: {
        userId: 'owner-1',
        popularityScore: 1,
      },
    });
    expect(tx.brandPopularityStat.create).toHaveBeenCalledWith({
      data: {
        brandId: 'brand-1',
        popularityScore: 1,
      },
    });
  });

  it('decrements popularity stats when a reservation leaves a counted status', async () => {
    const service = new ReservationPopularityStatsService();
    const tx = {
      servicePopularityStat: {
        findUnique: jest.fn().mockResolvedValue({
          popularityScore: 3,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      serviceOwnerPopularityStat: {
        findUnique: jest.fn().mockResolvedValue({
          popularityScore: 2,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      brandPopularityStat: {
        findUnique: jest.fn().mockResolvedValue({
          popularityScore: 1,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    await service.syncReservationTransition(tx, {
      serviceId: 'service-1',
      serviceOwnerUserId: 'owner-1',
      brandId: 'brand-1',
      fromStatus: ReservationStatus.CONFIRMED,
      toStatus: ReservationStatus.CANCELLED_BY_OWNER,
    });

    expect(tx.servicePopularityStat.update).toHaveBeenCalledWith({
      where: {
        serviceId: 'service-1',
      },
      data: {
        popularityScore: 2,
      },
    });
    expect(tx.serviceOwnerPopularityStat.update).toHaveBeenCalledWith({
      where: {
        userId: 'owner-1',
      },
      data: {
        popularityScore: 1,
      },
    });
    expect(tx.brandPopularityStat.update).toHaveBeenCalledWith({
      where: {
        brandId: 'brand-1',
      },
      data: {
        popularityScore: 0,
      },
    });
  });

  it('does nothing when a transition stays inside counted statuses', async () => {
    const service = new ReservationPopularityStatsService();
    const tx = {
      servicePopularityStat: {
        findUnique: jest.fn(),
      },
      serviceOwnerPopularityStat: {
        findUnique: jest.fn(),
      },
      brandPopularityStat: {
        findUnique: jest.fn(),
      },
    } as any;

    await service.syncReservationTransition(tx, {
      serviceId: 'service-1',
      serviceOwnerUserId: 'owner-1',
      brandId: 'brand-1',
      fromStatus: ReservationStatus.CONFIRMED,
      toStatus: ReservationStatus.COMPLETED,
    });

    expect(tx.servicePopularityStat.findUnique).not.toHaveBeenCalled();
    expect(tx.serviceOwnerPopularityStat.findUnique).not.toHaveBeenCalled();
    expect(tx.brandPopularityStat.findUnique).not.toHaveBeenCalled();
  });
});

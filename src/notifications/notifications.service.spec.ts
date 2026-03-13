/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { NotificationType } from '@prisma/client';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('creates in-app notifications and deletes invalid push tokens after dispatch', async () => {
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const pushTokenFindMany = jest
      .fn()
      .mockResolvedValue([{ token: 'token-1' }, { token: 'token-2' }]);
    const pushTokenDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const dispatchPushNotifications = jest.fn().mockResolvedValue({
      invalidTokens: ['token-2'],
    });

    const prisma = {
      notification: {
        createMany: notificationCreateMany,
      },
      pushToken: {
        findMany: pushTokenFindMany,
        deleteMany: pushTokenDeleteMany,
      },
    } as any;

    const service = new NotificationsService(prisma, {
      dispatchPushNotifications,
    } as any);

    await service.notifyReservationConfirmed({
      reservationId: 'reservation-1',
      customerUserId: 'customer-1',
      serviceName: 'Classic Haircut',
    });

    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'customer-1',
          type: NotificationType.RESERVATION_CONFIRMED,
          title: 'Reservation confirmed',
          body: 'Classic Haircut was confirmed.',
          dataJson: {
            reservationId: 'reservation-1',
          },
        },
      ],
    });
    expect(pushTokenFindMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['customer-1'],
        },
      },
      select: {
        token: true,
      },
    });
    expect(dispatchPushNotifications).toHaveBeenCalledWith({
      tokens: ['token-1', 'token-2'],
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Reservation confirmed',
      body: 'Classic Haircut was confirmed.',
      dataJson: {
        reservationId: 'reservation-1',
      },
    });
    expect(pushTokenDeleteMany).toHaveBeenCalledWith({
      where: {
        token: {
          in: ['token-2'],
        },
      },
    });
  });
});

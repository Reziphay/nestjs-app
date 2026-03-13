/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ReservationStatus } from '@prisma/client';

import { NotificationPreferencesService } from './notification-preferences.service';

const reservationConfig = {
  approvalTtlMinutes: 5,
  reminderLeadMinutes: [120, 30],
  qrSecret: 'test-qr-secret',
  qrTtlMinutes: 10,
};

describe('NotificationPreferencesService', () => {
  it('returns config defaults when the user has no custom notification settings', async () => {
    const service = new NotificationPreferencesService(
      {
        userNotificationSettings: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      } as any,
      reservationConfig as any,
      {} as any,
    );

    const result = await service.getResolvedNotificationSettings('customer-1');

    expect(result).toEqual({
      hasCustomPreferences: false,
      upcomingAppointmentReminders: {
        enabled: true,
        leadMinutes: [120, 30],
      },
    });
  });

  it('updates reminder settings and reschedules future confirmed reservations', async () => {
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'customer-1',
    });
    const settingsFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        userId: 'customer-1',
        upcomingAppointmentRemindersEnabled: true,
        upcomingAppointmentReminderLeadMinutes: [120, 30],
      })
      .mockResolvedValueOnce({
        userId: 'customer-1',
        upcomingAppointmentRemindersEnabled: false,
        upcomingAppointmentReminderLeadMinutes: [15],
      });
    const settingsUpsert = jest.fn().mockResolvedValue(undefined);
    const reservationFindMany = jest.fn().mockResolvedValue([
      {
        id: 'reservation-1',
        requestedStartAt: new Date('2026-03-20T10:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
      },
    ]);
    const cancelUpcomingReminders = jest.fn().mockResolvedValue(undefined);
    const scheduleUpcomingReminders = jest.fn().mockResolvedValue(1);

    const service = new NotificationPreferencesService(
      {
        userRole: {
          findUnique: userRoleFindUnique,
        },
        userNotificationSettings: {
          findUnique: settingsFindUnique,
          upsert: settingsUpsert,
        },
        reservation: {
          findMany: reservationFindMany,
        },
      } as any,
      reservationConfig as any,
      {
        cancelUpcomingReminders,
        scheduleUpcomingReminders,
      } as any,
    );

    const result = await service.updateNotificationSettings('customer-1', {
      upcomingAppointmentReminders: {
        enabled: false,
        leadMinutes: [15, 15],
      },
    });

    expect(settingsUpsert).toHaveBeenCalledWith({
      where: {
        userId: 'customer-1',
      },
      update: {
        upcomingAppointmentRemindersEnabled: false,
        upcomingAppointmentReminderLeadMinutes: [15],
      },
      create: {
        userId: 'customer-1',
        upcomingAppointmentRemindersEnabled: false,
        upcomingAppointmentReminderLeadMinutes: [15],
      },
    });
    expect(cancelUpcomingReminders).toHaveBeenCalledWith('reservation-1');
    expect(scheduleUpcomingReminders).not.toHaveBeenCalled();
    expect(result).toEqual({
      notificationSettings: {
        hasCustomPreferences: true,
        upcomingAppointmentReminders: {
          enabled: false,
          leadMinutes: [15],
        },
      },
    });
  });
});

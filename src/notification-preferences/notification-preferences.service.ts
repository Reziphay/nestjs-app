import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ReservationStatus } from '@prisma/client';

import { reservationConfig } from '../config';
import { AppRole } from '../common/enums/app-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationJobsService } from '../reservations/reservation-jobs.service';
import { UpdateNotificationSettingsDto } from '../users/dto/update-notification-settings.dto';

export type ResolvedNotificationSettings = {
  hasCustomPreferences: boolean;
  upcomingAppointmentReminders: {
    enabled: boolean;
    leadMinutes: number[];
  };
};

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(reservationConfig.KEY)
    private readonly reservationConfiguration: ConfigType<
      typeof reservationConfig
    >,
    @Inject(forwardRef(() => ReservationJobsService))
    private readonly reservationJobsService: ReservationJobsService,
  ) {}

  async getNotificationSettings(
    userId: string,
  ): Promise<Record<string, ResolvedNotificationSettings>> {
    await this.assertCustomerRole(userId);

    return {
      notificationSettings: await this.getResolvedNotificationSettings(userId),
    };
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<Record<string, ResolvedNotificationSettings>> {
    await this.assertCustomerRole(userId);

    const currentSettings =
      await this.prisma.userNotificationSettings.findUnique({
        where: {
          userId,
        },
      });
    const defaultLeadMinutes = [
      ...this.reservationConfiguration.reminderLeadMinutes,
    ];
    const requestedReminderSettings = dto.upcomingAppointmentReminders;
    const reminderLeadMinutes = this.resolveReminderLeadMinutes(
      requestedReminderSettings?.leadMinutes,
      currentSettings?.upcomingAppointmentReminderLeadMinutes ??
        defaultLeadMinutes,
    );
    const remindersEnabled =
      requestedReminderSettings?.enabled ??
      currentSettings?.upcomingAppointmentRemindersEnabled ??
      true;

    if (remindersEnabled && reminderLeadMinutes.length === 0) {
      throw new BadRequestException(
        'At least one reminder lead time is required when reminders are enabled.',
      );
    }

    await this.prisma.userNotificationSettings.upsert({
      where: {
        userId,
      },
      update: {
        upcomingAppointmentRemindersEnabled: remindersEnabled,
        upcomingAppointmentReminderLeadMinutes: reminderLeadMinutes,
      },
      create: {
        userId,
        upcomingAppointmentRemindersEnabled: remindersEnabled,
        upcomingAppointmentReminderLeadMinutes: reminderLeadMinutes,
      },
    });

    const resolvedSettings = await this.getResolvedNotificationSettings(userId);
    await this.rescheduleUpcomingReservationReminders(userId, resolvedSettings);

    return {
      notificationSettings: resolvedSettings,
    };
  }

  async getResolvedNotificationSettings(
    userId: string,
  ): Promise<ResolvedNotificationSettings> {
    const settings = await this.prisma.userNotificationSettings.findUnique({
      where: {
        userId,
      },
    });

    return {
      hasCustomPreferences: Boolean(settings),
      upcomingAppointmentReminders: {
        enabled: settings?.upcomingAppointmentRemindersEnabled ?? true,
        leadMinutes: this.resolveReminderLeadMinutes(
          settings?.upcomingAppointmentReminderLeadMinutes,
          this.reservationConfiguration.reminderLeadMinutes,
        ),
      },
    };
  }

  private async rescheduleUpcomingReservationReminders(
    userId: string,
    settings: ResolvedNotificationSettings,
  ): Promise<void> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        customerUserId: userId,
        status: ReservationStatus.CONFIRMED,
        requestedStartAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        requestedStartAt: true,
      },
      orderBy: {
        requestedStartAt: 'asc',
      },
    });

    for (const reservation of reservations) {
      await this.reservationJobsService.cancelUpcomingReminders(reservation.id);

      if (settings.upcomingAppointmentReminders.enabled) {
        await this.reservationJobsService.scheduleUpcomingReminders(
          reservation.id,
          reservation.requestedStartAt,
          settings.upcomingAppointmentReminders.leadMinutes,
        );
      }
    }
  }

  private async assertCustomerRole(userId: string): Promise<void> {
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role: AppRole.UCR,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!userRole) {
      throw new ForbiddenException(
        'Notification reminder settings are only available to customer accounts.',
      );
    }
  }

  private resolveReminderLeadMinutes(
    leadMinutes: number[] | undefined,
    fallbackLeadMinutes: number[],
  ): number[] {
    const sourceLeadMinutes = leadMinutes ?? fallbackLeadMinutes;

    return [...new Set(sourceLeadMinutes.map((value) => Number(value)))]
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((left, right) => right - left);
  }
}

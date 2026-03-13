import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AppRole,
  NotificationType,
  Prisma,
  ReservationDelayStatus,
  ReportTargetType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { PushDeliveryService } from './push-delivery.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  dataJson?: Prisma.InputJsonValue | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDeliveryService: PushDeliveryService,
  ) {}

  async listNotifications(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<Record<string, unknown>> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 50,
    });

    return {
      items: notifications.map((notification) =>
        this.serializeNotification(notification),
      ),
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<Record<string, unknown>> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        isRead: true,
        readAt: notification.readAt ?? new Date(),
      },
    });

    return {
      notification: this.serializeNotification(updatedNotification),
    };
  }

  async markAllRead(userId: string): Promise<Record<string, unknown>> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      markedCount: result.count,
    };
  }

  async getUnreadCount(userId: string): Promise<Record<string, unknown>> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      unreadCount: count,
    };
  }

  async registerPushToken(
    userId: string,
    dto: RegisterPushTokenDto,
  ): Promise<Record<string, unknown>> {
    const pushToken = await this.prisma.pushToken.upsert({
      where: {
        token: dto.token.trim(),
      },
      update: {
        userId,
        platform: dto.platform,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        platform: dto.platform,
        token: dto.token.trim(),
        lastSeenAt: new Date(),
      },
    });

    return {
      pushToken: {
        id: pushToken.id,
        platform: pushToken.platform,
        token: pushToken.token,
        lastSeenAt: pushToken.lastSeenAt,
      },
    };
  }

  async notifyReservationReceived(input: {
    reservationId: string;
    ownerUserId: string;
    serviceName: string;
    customerName: string;
  }): Promise<void> {
    await this.createNotifications([input.ownerUserId], {
      type: NotificationType.RESERVATION_RECEIVED,
      title: 'Reservation received',
      body: `${input.customerName} requested ${input.serviceName}.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationConfirmed(input: {
    reservationId: string;
    customerUserId: string;
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications([input.customerUserId], {
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Reservation confirmed',
      body: `${input.serviceName} was confirmed.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationRejected(input: {
    reservationId: string;
    customerUserId: string;
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications([input.customerUserId], {
      type: NotificationType.RESERVATION_REJECTED,
      title: 'Reservation rejected',
      body: `${input.serviceName} was rejected.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationCancelled(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_CANCELLED,
      title: 'Reservation cancelled',
      body: `${input.serviceName} was cancelled.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationChangeRequested(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_CHANGE_REQUESTED,
      title: 'Reservation change requested',
      body: `${input.serviceName} has a pending change request.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationDelayUpdated(input: {
    reservationId: string;
    ownerUserId: string;
    serviceName: string;
    customerName: string;
    status: ReservationDelayStatus;
    estimatedArrivalMinutes: number | null;
    note: string | null;
  }): Promise<void> {
    await this.createNotifications([input.ownerUserId], {
      type: NotificationType.RESERVATION_DELAY_UPDATED,
      title:
        input.status === ReservationDelayStatus.ARRIVED
          ? 'Customer arrived'
          : 'Customer running late',
      body: this.formatDelayStatusBody(input),
      dataJson: {
        reservationId: input.reservationId,
        status: input.status,
        estimatedArrivalMinutes: input.estimatedArrivalMinutes,
        note: input.note,
      },
    });
  }

  async notifyReservationReminder(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
    startsAt: Date;
    leadMinutes: number;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_REMINDER,
      title: 'Upcoming appointment',
      body: `${input.serviceName} starts in ${this.formatReminderLeadTime(input.leadMinutes)}.`,
      dataJson: {
        reservationId: input.reservationId,
        startsAt: input.startsAt.toISOString(),
        leadMinutes: input.leadMinutes,
      },
    });
  }

  async notifyReservationCompleted(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_COMPLETED,
      title: 'Reservation completed',
      body: `${input.serviceName} was completed.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationExpired(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_EXPIRED,
      title: 'Reservation expired',
      body: `${input.serviceName} expired without approval.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyReservationNoShow(input: {
    reservationId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.RESERVATION_NO_SHOW,
      title: 'Reservation marked as no-show',
      body: `${input.serviceName} was marked as a no-show.`,
      dataJson: {
        reservationId: input.reservationId,
      },
    });
  }

  async notifyPenaltyApplied(input: {
    userId: string;
    activePoints: number;
    action?: string;
  }): Promise<void> {
    await this.createNotifications([input.userId], {
      type: NotificationType.PENALTY_APPLIED,
      title: 'Penalty applied',
      body: input.action
        ? `You now have ${input.activePoints} active penalty points. Action: ${input.action}.`
        : `You now have ${input.activePoints} active penalty points.`,
      dataJson: {
        activePoints: input.activePoints,
        action: input.action ?? null,
      },
    });
  }

  async notifyReviewReceived(input: {
    reviewId: string;
    recipientUserIds: string[];
    serviceName: string;
  }): Promise<void> {
    await this.createNotifications(input.recipientUserIds, {
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New review received',
      body: `${input.serviceName} received a new review.`,
      dataJson: {
        reviewId: input.reviewId,
      },
    });
  }

  async notifyReviewReported(input: { reportId: string }): Promise<void> {
    await this.notifyReportReceived({
      reportId: input.reportId,
      targetType: ReportTargetType.REVIEW,
    });
  }

  async notifyReportReceived(input: {
    reportId: string;
    targetType: ReportTargetType;
  }): Promise<void> {
    await this.notifyAdmins({
      type: NotificationType.REPORT_RECEIVED,
      title: 'New report received',
      body: `${this.formatReportTargetType(input.targetType)} report awaits moderation.`,
      dataJson: {
        reportId: input.reportId,
        targetType: input.targetType,
      },
    });
  }

  async notifyObjectionReceived(input: { objectionId: string }): Promise<void> {
    await this.notifyAdmins({
      type: NotificationType.OBJECTION_RECEIVED,
      title: 'Reservation objection received',
      body: 'A reservation objection awaits review.',
      dataJson: {
        objectionId: input.objectionId,
      },
    });
  }

  private async notifyAdmins(input: NotificationInput): Promise<void> {
    const adminUsers = await this.prisma.userRole.findMany({
      where: {
        role: AppRole.ADMIN,
      },
      select: {
        userId: true,
      },
    });

    await this.createNotifications(
      adminUsers.map((role) => role.userId),
      input,
    );
  }

  private async createNotifications(
    userIds: string[],
    input: NotificationInput,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        dataJson: input.dataJson ?? Prisma.JsonNull,
      })),
    });

    try {
      const pushTokens = await this.prisma.pushToken.findMany({
        where: {
          userId: {
            in: uniqueUserIds,
          },
        },
        select: {
          token: true,
        },
      });

      const dispatchResult =
        await this.pushDeliveryService.dispatchPushNotifications({
          tokens: pushTokens.map((pushToken) => pushToken.token),
          type: input.type,
          title: input.title,
          body: input.body,
          dataJson: input.dataJson ?? null,
        });

      if (dispatchResult.invalidTokens.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: {
            token: {
              in: dispatchResult.invalidTokens,
            },
          },
        });
      }
    } catch (error) {
      this.logger.error(
        'Push delivery failed after in-app notifications were created.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private serializeNotification(notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    dataJson: Prisma.JsonValue | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.dataJson,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  private formatReminderLeadTime(leadMinutes: number): string {
    if (leadMinutes % 60 === 0) {
      const hours = leadMinutes / 60;

      return hours === 1 ? '1 hour' : `${hours} hours`;
    }

    return leadMinutes === 1 ? '1 minute' : `${leadMinutes} minutes`;
  }

  private formatDelayStatusBody(input: {
    serviceName: string;
    customerName: string;
    status: ReservationDelayStatus;
    estimatedArrivalMinutes: number | null;
    note: string | null;
  }): string {
    if (input.status === ReservationDelayStatus.ARRIVED) {
      return `${input.customerName} marked themselves as arrived for ${input.serviceName}.`;
    }

    if (input.estimatedArrivalMinutes != null) {
      return `${input.customerName} reported a delay for ${input.serviceName}. ETA ${input.estimatedArrivalMinutes} minutes.`;
    }

    return `${input.customerName} reported a delay for ${input.serviceName}.`;
  }

  private formatReportTargetType(targetType: ReportTargetType): string {
    switch (targetType) {
      case ReportTargetType.USER:
        return 'User';
      case ReportTargetType.BRAND:
        return 'Brand';
      case ReportTargetType.SERVICE:
        return 'Service';
      case ReportTargetType.REVIEW:
        return 'Review';
      default:
        return 'New';
    }
  }
}

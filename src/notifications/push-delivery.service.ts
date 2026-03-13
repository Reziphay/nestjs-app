import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { NotificationType, Prisma } from '@prisma/client';

import { notificationsConfig } from '../config';

const FCM_APP_NAME = 'reziphay-backend-fcm';
const FCM_MAX_TOKENS_PER_BATCH = 500;

type DispatchPushNotificationsInput = {
  tokens: string[];
  type: NotificationType;
  title: string;
  body: string;
  dataJson?: Prisma.InputJsonValue | null;
};

type DispatchPushNotificationsResult = {
  invalidTokens: string[];
};

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);
  private readonly messaging: Messaging | null;

  constructor(
    @Inject(notificationsConfig.KEY)
    private readonly notificationsConfiguration: ConfigType<
      typeof notificationsConfig
    >,
  ) {
    this.messaging = this.createMessagingClient();
  }

  async dispatchPushNotifications(
    input: DispatchPushNotificationsInput,
  ): Promise<DispatchPushNotificationsResult> {
    const uniqueTokens = [
      ...new Set(input.tokens.map((token) => token.trim())),
    ].filter(Boolean);

    if (!this.messaging || uniqueTokens.length === 0) {
      return {
        invalidTokens: [],
      };
    }

    const invalidTokens = new Set<string>();

    for (const tokenBatch of this.chunkTokens(uniqueTokens)) {
      const response = await this.messaging.sendEachForMulticast({
        tokens: tokenBatch,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: {
          notificationType: input.type,
          payloadJson: JSON.stringify(input.dataJson ?? null),
        },
      });

      response.responses.forEach((entry, index) => {
        if (entry.success) {
          return;
        }

        const token = tokenBatch[index];
        const errorCode =
          entry.error && 'code' in entry.error ? entry.error.code : undefined;

        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.add(token);
          return;
        }

        this.logger.warn(
          `Push delivery failed for token ${token}: ${errorCode ?? 'unknown-error'}.`,
        );
      });
    }

    return {
      invalidTokens: [...invalidTokens],
    };
  }

  private createMessagingClient(): Messaging | null {
    if (!this.notificationsConfiguration.fcm.enabled) {
      this.logger.log(
        'FCM push delivery is disabled; using in-app notifications only.',
      );
      return null;
    }

    const existingApp = getApps().find((app) => app.name === FCM_APP_NAME);
    const firebaseApp =
      existingApp ??
      initializeApp(
        {
          credential: cert({
            projectId: this.notificationsConfiguration.fcm.projectId,
            clientEmail: this.notificationsConfiguration.fcm.clientEmail,
            privateKey: this.notificationsConfiguration.fcm.privateKey,
          }),
        },
        FCM_APP_NAME,
      );

    return getMessaging(existingApp ? getApp(FCM_APP_NAME) : firebaseApp);
  }

  private chunkTokens(tokens: string[]): string[][] {
    const batches: string[][] = [];

    for (
      let index = 0;
      index < tokens.length;
      index += FCM_MAX_TOKENS_PER_BATCH
    ) {
      batches.push(tokens.slice(index, index + FCM_MAX_TOKENS_PER_BATCH));
    }

    return batches;
  }
}

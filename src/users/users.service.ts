import { ForbiddenException, Injectable } from '@nestjs/common';

import { AppRole } from '../common/enums/app-role.enum';
import { AuthService } from '../auth/auth.service';
import { NotificationPreferencesService } from '../notification-preferences/notification-preferences.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDocumentsService } from '../search-documents/search-documents.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly searchDocumentsService: SearchDocumentsService,
  ) {}

  getMe(userId: string, sessionId: string): Promise<Record<string, unknown>> {
    return this.authService.getSessionAwareProfile(userId, sessionId);
  }

  async getRoles(
    userId: string,
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    const profile = await this.authService.getSessionAwareProfile(
      userId,
      sessionId,
    );
    const user = profile['user'] as Record<string, unknown>;

    return {
      roles: user['roles'],
      activeRole: user['activeRole'],
    };
  }

  async activateUso(
    userId: string,
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    await this.prisma.userRole.upsert({
      where: {
        userId_role: {
          userId,
          role: AppRole.USO,
        },
      },
      update: {},
      create: {
        userId,
        role: AppRole.USO,
      },
    });

    await this.searchDocumentsService.syncProviderDocument(userId);

    return this.authService.reissueTokensForSession(
      userId,
      sessionId,
      AppRole.USO,
    );
  }

  async switchRole(
    userId: string,
    sessionId: string,
    role: (typeof AppRole)[keyof typeof AppRole],
  ): Promise<Record<string, unknown>> {
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
    });

    if (!userRole) {
      throw new ForbiddenException(
        `This account does not have the ${role} role.`,
      );
    }

    return this.authService.reissueTokensForSession(userId, sessionId, role);
  }

  getNotificationSettings(userId: string): Promise<Record<string, unknown>> {
    return this.notificationPreferencesService.getNotificationSettings(userId);
  }

  updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<Record<string, unknown>> {
    return this.notificationPreferencesService.updateNotificationSettings(
      userId,
      dto,
    );
  }
}

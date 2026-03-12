import { ForbiddenException, Injectable } from '@nestjs/common';

import { AppRole } from '../common/enums/app-role.enum';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
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
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserSetting } from '@prisma/client';

import { AppHttpException } from 'src/common/exceptions/app-http.exception';
import { UserProfileDto } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  RegisterPushDeviceDto,
  UpdateMeDto,
  UpdateUserSettingsDto,
  UserSettingsDto,
} from 'src/modules/users/dto/users.dto';

const currentUserInclude = Prisma.validator<Prisma.UserInclude>()({
  profile: true,
  roles: true,
});

type CurrentUser = Prisma.UserGetPayload<{
  include: typeof currentUserInclude;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateMe(userId: string, dto: UpdateMeDto): Promise<UserProfileDto> {
    const user = await this.getRequiredUser(userId);
    const fullNameProvided = this.hasOwn(dto, 'fullName');
    const bioProvided = this.hasOwn(dto, 'bio');
    const avatarUrlProvided = this.hasOwn(dto, 'avatarUrl');

    if (!fullNameProvided && !bioProvided && !avatarUrlProvided) {
      return this.toUserProfileDto(user);
    }

    if (!user.profile) {
      await this.prismaService.userProfile.create({
        data: {
          userId,
          fullName:
            dto.fullName ?? this.generateDefaultFullName(user.phoneNumber),
          bio: bioProvided ? (dto.bio ?? null) : null,
          avatarUrl: avatarUrlProvided ? (dto.avatarUrl ?? null) : null,
        },
      });
    } else {
      await this.prismaService.userProfile.update({
        where: {
          userId,
        },
        data: {
          ...(fullNameProvided ? { fullName: dto.fullName } : {}),
          ...(bioProvided ? { bio: dto.bio ?? null } : {}),
          ...(avatarUrlProvided ? { avatarUrl: dto.avatarUrl ?? null } : {}),
        },
      });
    }

    return this.toUserProfileDto(await this.getRequiredUser(userId));
  }

  async getSettings(userId: string): Promise<UserSettingsDto> {
    const settings = await this.ensureSettings(userId);

    return this.toUserSettingsDto(settings);
  }

  async updateSettings(
    userId: string,
    dto: UpdateUserSettingsDto,
  ): Promise<UserSettingsDto> {
    const currentSettings = await this.ensureSettings(userId);

    if (
      !this.hasOwn(dto, 'upcomingReminderEnabled') &&
      !this.hasOwn(dto, 'upcomingReminderMinutes') &&
      !this.hasOwn(dto, 'pushNotificationsEnabled') &&
      !this.hasOwn(dto, 'marketingNotificationsEnabled')
    ) {
      return this.toUserSettingsDto(currentSettings);
    }

    const updatedSettings = await this.prismaService.userSetting.update({
      where: {
        userId,
      },
      data: {
        ...(this.hasOwn(dto, 'upcomingReminderEnabled')
          ? {
              upcomingReminderEnabled: dto.upcomingReminderEnabled,
            }
          : {}),
        ...(this.hasOwn(dto, 'upcomingReminderMinutes')
          ? {
              upcomingReminderMinutes: dto.upcomingReminderMinutes,
            }
          : {}),
        ...(this.hasOwn(dto, 'pushNotificationsEnabled')
          ? {
              pushEnabled: dto.pushNotificationsEnabled,
            }
          : {}),
        ...(this.hasOwn(dto, 'marketingNotificationsEnabled')
          ? {
              marketingPushEnabled: dto.marketingNotificationsEnabled,
            }
          : {}),
      },
    });

    return this.toUserSettingsDto(updatedSettings);
  }

  async registerDevice(
    userId: string,
    dto: RegisterPushDeviceDto,
  ): Promise<{
    deviceId: string;
    registered: true;
  }> {
    await this.assertUserExists(userId);

    const now = new Date();
    const existingDevice = await this.prismaService.pushDevice.findUnique({
      where: {
        deviceToken: dto.deviceToken,
      },
    });

    if (existingDevice) {
      const device = await this.prismaService.pushDevice.update({
        where: {
          id: existingDevice.id,
        },
        data: {
          userId,
          platform: dto.platform,
          ...(this.hasOwn(dto, 'deviceName')
            ? { deviceName: dto.deviceName ?? null }
            : {}),
          ...(this.hasOwn(dto, 'appVersion')
            ? { appVersion: dto.appVersion ?? null }
            : {}),
          lastSeenAt: now,
          isActive: true,
          revokedAt: null,
        },
      });

      return {
        deviceId: device.id,
        registered: true,
      };
    }

    const device = await this.prismaService.pushDevice.create({
      data: {
        userId,
        deviceToken: dto.deviceToken,
        platform: dto.platform,
        deviceName: dto.deviceName ?? null,
        appVersion: dto.appVersion ?? null,
        lastSeenAt: now,
        isActive: true,
      },
    });

    return {
      deviceId: device.id,
      registered: true,
    };
  }

  async unregisterDevice(
    userId: string,
    deviceId: string,
  ): Promise<{ deleted: true }> {
    const device = await this.prismaService.pushDevice.findFirst({
      where: {
        id: deviceId,
        userId,
      },
      select: {
        id: true,
        isActive: true,
        revokedAt: true,
      },
    });

    if (!device) {
      throw new AppHttpException(
        'PUSH_DEVICE_NOT_FOUND',
        'Push device could not be found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (device.isActive || !device.revokedAt) {
      await this.prismaService.pushDevice.update({
        where: {
          id: device.id,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });
    }

    return {
      deleted: true,
    };
  }

  private async getRequiredUser(userId: string): Promise<CurrentUser> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      include: currentUserInclude,
    });

    if (!user) {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Authenticated user could not be found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Authenticated user could not be found',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private async ensureSettings(userId: string): Promise<UserSetting> {
    await this.assertUserExists(userId);

    const settings = await this.prismaService.userSetting.findUnique({
      where: {
        userId,
      },
    });

    if (settings) {
      return settings;
    }

    return this.prismaService.userSetting.create({
      data: {
        userId,
      },
    });
  }

  private toUserProfileDto(user: CurrentUser): UserProfileDto {
    const updatedAt =
      user.profile && user.profile.updatedAt > user.updatedAt
        ? user.profile.updatedAt
        : user.updatedAt;

    return {
      id: user.id,
      fullName:
        user.profile?.fullName ??
        this.generateDefaultFullName(user.phoneNumber),
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      email: user.email ?? null,
      phoneNumber: user.phoneNumber,
      roles: this.toRoleList(user.roles),
      activeRole: user.activeRole,
      accountStatus: user.accountStatus,
      suspensionEndsAt: user.suspensionEndsAt?.toISOString() ?? null,
      closedReason: user.closedReason ?? null,
      verification: {
        phoneVerified: Boolean(user.phoneVerifiedAt),
        emailVerified: Boolean(user.emailVerifiedAt),
        email: user.email ?? null,
        phoneNumber: user.phoneNumber,
      },
      createdAt: user.createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  private toUserSettingsDto(settings: UserSetting): UserSettingsDto {
    return {
      upcomingReminderEnabled: settings.upcomingReminderEnabled,
      upcomingReminderMinutes: settings.upcomingReminderMinutes,
      pushNotificationsEnabled: settings.pushEnabled,
      marketingNotificationsEnabled: settings.marketingPushEnabled,
    };
  }

  private toRoleList(
    roles: Array<{
      role: UserRole;
    }>,
  ): UserRole[] {
    const roleOrder: UserRole[] = [UserRole.CUSTOMER, UserRole.SERVICE_OWNER];

    return roleOrder.filter((role) => roles.some((item) => item.role === role));
  }

  private generateDefaultFullName(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');

    return `User ${digits.slice(-4)}`;
  }

  private hasOwn(target: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(target, key);
  }
}

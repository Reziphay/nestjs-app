import { randomBytes, randomInt, createHash } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  AccountStatus,
  EmailVerificationPurpose,
  Prisma,
  SessionStatus,
  UserRole,
} from '@prisma/client';

import { AppHttpException } from 'src/common/exceptions/app-http.exception';
import {
  RequestEmailVerificationDto,
  RequestOtpDto,
  SwitchRoleDto,
  VerifyOtpDto,
} from 'src/modules/auth/dto/auth.dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  AccessTokenPayload,
  UserProfileDto,
} from 'src/modules/auth/auth.types';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

const authUserInclude = Prisma.validator<Prisma.UserInclude>()({
  profile: true,
  roles: true,
});

type AuthUser = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(
    dto: RequestOtpDto,
    metadata: RequestMetadata,
  ): Promise<{
    otpRequestId: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    const phoneNumber = this.normalizePhoneNumber(dto.phoneNumber);
    this.assertPhoneNumber(phoneNumber);

    const now = new Date();
    const requestWindowStart = new Date(
      now.getTime() -
        this.getNumberConfig('auth.otpRequestWindowMinutes') * 60 * 1000,
    );

    const recentRequestCount = await this.prismaService.authOtp.count({
      where: {
        phoneNumber,
        purpose: 'LOGIN',
        createdAt: {
          gte: requestWindowStart,
        },
      },
    });

    if (
      recentRequestCount >= this.getNumberConfig('auth.otpMaxRequestsPerWindow')
    ) {
      throw new AppHttpException(
        'OTP_REQUEST_BLOCKED',
        'Too many OTP requests for this phone number',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const latestActiveRequest = await this.prismaService.authOtp.findFirst({
      where: {
        phoneNumber,
        purpose: 'LOGIN',
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (
      latestActiveRequest?.resendAvailableAt &&
      latestActiveRequest.resendAvailableAt > now
    ) {
      throw new AppHttpException(
        'OTP_RATE_LIMITED',
        'OTP resend is temporarily rate limited',
        HttpStatus.TOO_MANY_REQUESTS,
        {
          resendAvailableAt:
            latestActiveRequest.resendAvailableAt.toISOString(),
        },
      );
    }

    const otpCode = this.generateOtpCode();
    const expiresAt = new Date(
      now.getTime() + this.getNumberConfig('auth.otpTtlMinutes') * 60 * 1000,
    );
    const resendAvailableAt = new Date(
      now.getTime() +
        this.getNumberConfig('auth.otpResendCooldownSeconds') * 1000,
    );

    const otpRequest = await this.prismaService.authOtp.create({
      data: {
        phoneNumber,
        purpose: 'LOGIN',
        roleHint: dto.roleHint ?? null,
        codeHash: this.hashValue(otpCode),
        expiresAt,
        resendAvailableAt,
        requestIp: metadata.ipAddress ?? null,
      },
    });

    if (
      this.configService.get<string>('app.env', { infer: true }) !==
      'production'
    ) {
      this.logger.log(
        `Generated OTP ${otpCode} for ${phoneNumber} (request ${otpRequest.id})`,
      );
    }

    return {
      otpRequestId: otpRequest.id,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    metadata: RequestMetadata,
  ): Promise<{
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string;
    };
    user: UserProfileDto;
    isNewUser: boolean;
  }> {
    const phoneNumber = this.normalizePhoneNumber(dto.phoneNumber);
    const now = new Date();
    const otpRequest = await this.prismaService.authOtp.findUnique({
      where: { id: dto.otpRequestId },
    });

    if (
      !otpRequest ||
      otpRequest.phoneNumber !== phoneNumber ||
      otpRequest.purpose !== 'LOGIN'
    ) {
      throw new AppHttpException(
        'OTP_INVALID',
        'OTP request is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (otpRequest.consumedAt) {
      throw new AppHttpException(
        'OTP_ALREADY_USED',
        'OTP has already been used',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (otpRequest.expiresAt <= now) {
      throw new AppHttpException(
        'OTP_EXPIRED',
        'OTP has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      otpRequest.attemptCount >= this.getNumberConfig('auth.otpMaxAttempts')
    ) {
      throw new AppHttpException(
        'OTP_INVALID',
        'OTP is no longer valid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const providedCodeHash = this.hashValue(dto.code);

    if (providedCodeHash !== otpRequest.codeHash) {
      await this.prismaService.authOtp.update({
        where: { id: otpRequest.id },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      throw new AppHttpException(
        'OTP_INVALID',
        'OTP is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingUser = await this.getUserForAuth({
      phoneNumber,
    });
    let user: AuthUser;
    let isNewUser = false;

    if (!existingUser) {
      isNewUser = true;
      const activeRole = otpRequest.roleHint ?? UserRole.CUSTOMER;
      const fullName = this.generateDefaultFullName(phoneNumber);

      user = await this.prismaService.user.create({
        data: {
          phoneNumber,
          activeRole,
          phoneVerifiedAt: now,
          accountStatus: AccountStatus.ACTIVE,
          lastLoginAt: now,
          profile: {
            create: {
              fullName,
            },
          },
          settings: {
            create: {},
          },
          roles: {
            create: [
              {
                role: activeRole,
              },
            ],
          },
        },
        include: authUserInclude,
      });
    } else {
      user = await this.normalizeUserAccountState(existingUser.id);

      if (user.accountStatus === AccountStatus.SUSPENDED) {
        throw new AppHttpException(
          'ACCOUNT_SUSPENDED',
          'Account is currently suspended',
          HttpStatus.FORBIDDEN,
        );
      }

      if (user.accountStatus === AccountStatus.CLOSED) {
        throw new AppHttpException(
          'ACCOUNT_CLOSED',
          'Account is closed',
          HttpStatus.FORBIDDEN,
        );
      }

      const roleToActivate = otpRequest.roleHint ?? user.activeRole;

      if (!user.roles.some((role) => role.role === roleToActivate)) {
        await this.prismaService.roleAssignment.create({
          data: {
            userId: user.id,
            role: roleToActivate,
          },
        });
      }

      user = await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: now,
          activeRole: roleToActivate,
          lastLoginAt: now,
        },
        include: authUserInclude,
      });
    }

    await this.prismaService.authOtp.update({
      where: { id: otpRequest.id },
      data: {
        consumedAt: now,
        userId: user.id,
      },
    });

    const tokens = await this.createSessionTokens(user, {
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      deviceName: dto.device?.deviceName,
      devicePlatform: dto.device?.platform,
      appVersion: dto.device?.appVersion,
    });

    return {
      tokens,
      user: this.toUserProfileDto(user),
      isNewUser,
    };
  }

  async requestEmailVerification(
    userId: string,
    dto: RequestEmailVerificationDto,
  ): Promise<{
    email: string;
    sent: true;
    cooldownSeconds: number;
  }> {
    const email = dto.email.trim().toLowerCase();
    const now = new Date();
    const user = await this.getRequiredUser(userId);

    if (user.email === email && user.emailVerifiedAt) {
      throw new AppHttpException(
        'EMAIL_ALREADY_VERIFIED',
        'Email is already verified',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingUser = await this.prismaService.user.findFirst({
      where: {
        email,
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new AppHttpException(
        'EMAIL_ALREADY_IN_USE',
        'Email is already in use',
        HttpStatus.CONFLICT,
      );
    }

    const latestToken =
      await this.prismaService.emailVerificationToken.findFirst({
        where: {
          userId,
          purpose: EmailVerificationPurpose.VERIFY_EMAIL,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    const cooldownSeconds = this.getNumberConfig(
      'auth.emailVerifyCooldownSeconds',
    );

    if (
      latestToken &&
      latestToken.createdAt > new Date(now.getTime() - cooldownSeconds * 1000)
    ) {
      throw new AppHttpException(
        'EMAIL_VERIFY_RATE_LIMITED',
        'Email verification is rate limited',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const rawToken = `emv_${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(
      now.getTime() +
        this.getNumberConfig('auth.emailVerifyTtlMinutes') * 60 * 1000,
    );

    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        email,
        emailVerifiedAt: null,
      },
    });

    await this.prismaService.emailVerificationToken.create({
      data: {
        userId,
        email,
        purpose: EmailVerificationPurpose.VERIFY_EMAIL,
        tokenHash: this.hashValue(rawToken),
        expiresAt,
      },
    });

    this.logger.log(
      `Email verification link for ${email}: ${this.buildEmailRedirect(
        dto.redirectUri,
        rawToken,
      )}`,
    );

    return {
      email,
      sent: true,
      cooldownSeconds,
    };
  }

  async verifyEmailToken(token: string): Promise<{
    verified: true;
    email: string;
  }> {
    const now = new Date();
    const verificationToken =
      await this.prismaService.emailVerificationToken.findFirst({
        where: {
          tokenHash: this.hashValue(token),
        },
        include: {
          user: true,
        },
      });

    if (!verificationToken) {
      throw new AppHttpException(
        'EMAIL_VERIFY_TOKEN_INVALID',
        'Email verification token is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (verificationToken.usedAt) {
      throw new AppHttpException(
        'EMAIL_VERIFY_TOKEN_ALREADY_USED',
        'Email verification token has already been used',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (verificationToken.expiresAt <= now) {
      throw new AppHttpException(
        'EMAIL_VERIFY_TOKEN_EXPIRED',
        'Email verification token has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prismaService.$transaction([
      this.prismaService.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: {
          usedAt: now,
        },
      }),
      this.prismaService.user.update({
        where: { id: verificationToken.userId },
        data: {
          email: verificationToken.email,
          emailVerifiedAt: now,
        },
      }),
    ]);

    return {
      verified: true,
      email: verificationToken.email,
    };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
  }> {
    const session = await this.prismaService.session.findFirst({
      where: {
        refreshTokenHash: this.hashValue(refreshToken),
      },
      include: {
        user: {
          include: authUserInclude,
        },
      },
    });

    if (!session) {
      throw new AppHttpException(
        'REFRESH_TOKEN_INVALID',
        'Refresh token is invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.status === SessionStatus.REVOKED || session.revokedAt) {
      throw new AppHttpException(
        'SESSION_REVOKED',
        'Session has been revoked',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.expiresAt <= new Date()) {
      await this.prismaService.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.EXPIRED,
        },
      });

      throw new AppHttpException(
        'REFRESH_TOKEN_EXPIRED',
        'Refresh token has expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const now = new Date();
    const nextRefreshToken = this.generateRefreshToken();
    const nextRefreshTokenExpiresAt = new Date(
      now.getTime() +
        this.getNumberConfig('auth.refreshTokenTtlDays') * 24 * 60 * 60 * 1000,
    );

    await this.prismaService.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashValue(nextRefreshToken),
        lastUsedAt: now,
        expiresAt: nextRefreshTokenExpiresAt,
        status: SessionStatus.ACTIVE,
      },
    });

    const accessTokenData = await this.createAccessToken(
      session.user.id,
      session.id,
    );

    return {
      accessToken: accessTokenData.accessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresAt: accessTokenData.accessTokenExpiresAt,
      refreshTokenExpiresAt: nextRefreshTokenExpiresAt.toISOString(),
    };
  }

  async logout(refreshToken: string): Promise<{ loggedOut: true }> {
    const session = await this.prismaService.session.findFirst({
      where: {
        refreshTokenHash: this.hashValue(refreshToken),
      },
      select: {
        id: true,
      },
    });

    if (session) {
      await this.prismaService.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
    }

    return {
      loggedOut: true,
    };
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.getRequiredUser(userId);

    return this.toUserProfileDto(user);
  }

  async switchRole(
    userId: string,
    dto: SwitchRoleDto,
  ): Promise<{ activeRole: UserRole; roles: UserRole[] }> {
    const user = await this.getRequiredUser(userId);
    const roles = this.toRoleList(user.roles);

    if (!roles.includes(dto.role)) {
      throw new AppHttpException(
        'ROLE_NOT_AVAILABLE',
        'Requested role is not available for this account',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        activeRole: dto.role,
      },
    });

    return {
      activeRole: dto.role,
      roles,
    };
  }

  private async createSessionTokens(
    user: AuthUser,
    sessionInput: {
      ipAddress?: string;
      userAgent?: string;
      deviceName?: string;
      devicePlatform?: string;
      appVersion?: string;
    },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
  }> {
    const refreshToken = this.generateRefreshToken();
    const now = new Date();
    const refreshTokenExpiresAt = new Date(
      now.getTime() +
        this.getNumberConfig('auth.refreshTokenTtlDays') * 24 * 60 * 60 * 1000,
    );

    const session = await this.prismaService.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashValue(refreshToken),
        status: SessionStatus.ACTIVE,
        ipAddress: sessionInput.ipAddress ?? null,
        userAgent: sessionInput.userAgent ?? null,
        deviceName: sessionInput.deviceName ?? null,
        devicePlatform: sessionInput.devicePlatform ?? null,
        appVersion: sessionInput.appVersion ?? null,
        lastUsedAt: now,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    const accessTokenData = await this.createAccessToken(user.id, session.id);

    return {
      accessToken: accessTokenData.accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenData.accessTokenExpiresAt,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  private async createAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresAt: string;
  }> {
    const accessTokenTtlMinutes = this.getNumberConfig(
      'auth.accessTokenTtlMinutes',
    );
    const payload: AccessTokenPayload = {
      sub: userId,
      sessionId,
      type: 'access',
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.accessTokenSecret', {
        infer: true,
      }),
      expiresIn: `${accessTokenTtlMinutes}m`,
    });
    const accessTokenExpiresAt = new Date(
      Date.now() + accessTokenTtlMinutes * 60 * 1000,
    );

    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }

  private toUserProfileDto(user: AuthUser): UserProfileDto {
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

  private toRoleList(
    roles: Array<{
      role: UserRole;
    }>,
  ): UserRole[] {
    const roleOrder: UserRole[] = [UserRole.CUSTOMER, UserRole.SERVICE_OWNER];

    return roleOrder.filter((role) => roles.some((item) => item.role === role));
  }

  private async getRequiredUser(userId: string): Promise<AuthUser> {
    const user = await this.getUserForAuth({
      id: userId,
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

  private async normalizeUserAccountState(userId: string): Promise<AuthUser> {
    const user = await this.getRequiredUser(userId);

    if (
      user.accountStatus === AccountStatus.SUSPENDED &&
      user.suspensionEndsAt &&
      user.suspensionEndsAt <= new Date()
    ) {
      return this.prismaService.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.ACTIVE,
          suspensionEndsAt: null,
        },
        include: authUserInclude,
      });
    }

    return user;
  }

  private async getUserForAuth(where: {
    id?: string;
    phoneNumber?: string;
  }): Promise<AuthUser | null> {
    return this.prismaService.user.findFirst({
      where,
      include: authUserInclude,
    });
  }

  private buildEmailRedirect(redirectUri: string, token: string): string {
    const separator = redirectUri.includes('?') ? '&' : '?';

    return `${redirectUri}${separator}token=${token}`;
  }

  private getNumberConfig(path: string): number {
    return Number(
      this.configService.get<number>(path, {
        infer: true,
      }),
    );
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.trim();
  }

  private assertPhoneNumber(phoneNumber: string): void {
    const e164Pattern = /^\+[1-9]\d{7,14}$/;

    if (!e164Pattern.test(phoneNumber)) {
      throw new AppHttpException(
        'PHONE_NUMBER_INVALID',
        'Phone number must be in E.164 format',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private generateOtpCode(): string {
    return randomInt(100000, 999999).toString();
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateDefaultFullName(phoneNumber: string): string {
    const lastDigits = phoneNumber.slice(-4);

    return `User ${lastDigits}`;
  }
}

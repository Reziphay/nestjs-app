import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthSession, OtpCode, Prisma } from '@prisma/client';
import { createHmac, randomBytes, randomInt } from 'crypto';

import { authConfig, appConfig } from '../config';
import { AppRole } from '../common/enums/app-role.enum';
import { JwtTokenType } from '../common/enums/jwt-token-type.enum';
import { MagicLinkPurpose } from '../common/enums/magic-link-purpose.enum';
import { OtpPurpose } from '../common/enums/otp-purpose.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { parseDurationToMilliseconds } from '../common/utils/duration.util';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { RequestEmailMagicLinkDto } from './dto/request-email-magic-link.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { VerifyEmailMagicLinkDto } from './dto/verify-email-magic-link.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roles: true;
  };
}>;

type AuthSessionRecord = AuthSession;

type RequestMetadata = {
  deviceInfo?: string | null;
  ip?: string | null;
};

@Injectable()
export class AuthService {
  private readonly accessTokenTtlMs: number;
  private readonly refreshTokenTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly authConfiguration: ConfigType<typeof authConfig>,
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {
    this.accessTokenTtlMs = parseDurationToMilliseconds(
      this.authConfiguration.accessTtl,
    );
    this.refreshTokenTtlMs = parseDurationToMilliseconds(
      this.authConfiguration.refreshTtl,
    );
  }

  async requestPhoneOtp(
    dto: RequestPhoneOtpDto,
  ): Promise<Record<string, unknown>> {
    const phone = this.normalizePhone(dto.phone);
    const email = dto.email ? this.normalizeEmail(dto.email) : null;
    const now = new Date();

    if (dto.purpose === OtpPurpose.REGISTER) {
      await this.assertRegisterableIdentity(phone, email);
    }

    // AUTHENTICATE purpose: no pre-check — user existence is determined at verify time

    await this.prisma.otpCode.updateMany({
      where: {
        phone,
        purpose: dto.purpose,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    const code = this.generateOtpCode();
    const expiresAt = this.addMinutes(
      now,
      this.authConfiguration.otpTtlMinutes,
    );

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: this.hashValue(code),
        purpose: dto.purpose,
        fullName: dto.fullName?.trim() || null,
        email,
        expiresAt,
      },
    });

    return {
      phone,
      purpose: dto.purpose,
      expiresAt,
      ...(this.appConfiguration.isProduction
        ? {}
        : {
            debugCode: code,
          }),
    };
  }

  async verifyPhoneOtp(
    dto: VerifyPhoneOtpDto,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    const phone = this.normalizePhone(dto.phone);
    const code = dto.code.trim();
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: dto.purpose,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP code is invalid or expired.');
    }

    if (otpRecord.attemptCount >= this.authConfiguration.otpMaxAttempts) {
      throw new ForbiddenException('OTP verification attempts exceeded.');
    }

    const hashedCode = this.hashValue(code);

    if (hashedCode !== otpRecord.codeHash) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      throw new UnauthorizedException('OTP code is invalid or expired.');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: {
        consumedAt: new Date(),
      },
    });

    if (
      dto.purpose !== OtpPurpose.AUTHENTICATE &&
      dto.purpose !== OtpPurpose.REGISTER &&
      dto.purpose !== OtpPurpose.LOGIN
    ) {
      throw new BadRequestException(
        'This OTP purpose is not enabled in Phase 1.',
      );
    }

    // AUTHENTICATE: check user existence and branch accordingly
    if (dto.purpose === OtpPurpose.AUTHENTICATE) {
      const existingUser = await this.prisma.user.findUnique({
        where: { phone },
        include: { roles: true },
      });

      if (existingUser) {
        // User exists → log them in
        this.assertUserCanAuthenticate(existingUser);
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            lastLoginAt: new Date(),
            phoneVerifiedAt: existingUser.phoneVerifiedAt ?? new Date(),
          },
        });
        existingUser.lastLoginAt = new Date();
        existingUser.phoneVerifiedAt = existingUser.phoneVerifiedAt ?? new Date();
        const activeRole = this.resolveDefaultActiveRole(existingUser);
        return this.createSessionResponse(existingUser, metadata, activeRole);
      }

      // User doesn't exist → issue a short-lived registration token
      const registrationToken = await this.jwtService.signAsync(
        { phone, type: 'registration_pending' },
        {
          secret: this.authConfiguration.accessSecret,
          expiresIn: '15m',
        },
      );
      return { requiresRegistration: true, phone, registrationToken };
    }

    const user =
      dto.purpose === OtpPurpose.REGISTER
        ? await this.registerUserFromOtp(otpRecord, dto)
        : await this.loginUserFromOtp(phone);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
      },
    });
    user.lastLoginAt = new Date();
    user.phoneVerifiedAt = user.phoneVerifiedAt ?? new Date();

    const activeRole = this.resolveDefaultActiveRole(user);

    return this.createSessionResponse(user, metadata, activeRole);
  }

  async completeRegistration(
    dto: CompleteRegistrationDto,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    let phone: string;
    try {
      const payload = await this.jwtService.verifyAsync<{
        phone: string;
        type: string;
      }>(dto.registrationToken, {
        secret: this.authConfiguration.accessSecret,
      });

      if (payload.type !== 'registration_pending') {
        throw new Error('Invalid token type');
      }
      phone = payload.phone;
    } catch {
      throw new UnauthorizedException('Registration token is invalid or expired.');
    }

    const fullName = dto.fullName.trim();
    const email = this.normalizeEmail(dto.email);

    await this.assertRegisterableIdentity(phone, email);

    const user = await this.prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        phoneVerifiedAt: new Date(),
        roles: {
          create: { role: AppRole.UCR },
        },
      },
      include: { roles: true },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    user.lastLoginAt = new Date();

    const activeRole = this.resolveDefaultActiveRole(user);
    return this.createSessionResponse(user, metadata, activeRole);
  }

  async requestEmailMagicLink(
    userId: string,
    dto: RequestEmailMagicLinkDto,
  ): Promise<Record<string, unknown>> {
    const user = await this.getUserOrThrow(userId);
    const email = this.normalizeEmail(dto.email ?? user.email ?? '');

    if (!email) {
      throw new BadRequestException(
        'An email address is required to request a magic link.',
      );
    }

    const existingOwner = await this.prisma.user.findFirst({
      where: {
        email,
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingOwner) {
      throw new ConflictException(
        'This email address is already associated with another account.',
      );
    }

    if (email !== user.email) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email,
          emailVerifiedAt: null,
        },
      });
    }

    const now = new Date();
    const expiresAt = this.addMinutes(
      now,
      this.authConfiguration.magicLinkTtlMinutes,
    );
    const token = this.generateSecureToken();

    await this.prisma.emailMagicLink.updateMany({
      where: {
        userId,
        purpose: MagicLinkPurpose.VERIFY_EMAIL,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    await this.prisma.emailMagicLink.create({
      data: {
        userId,
        email,
        tokenHash: this.hashValue(token),
        purpose: MagicLinkPurpose.VERIFY_EMAIL,
        expiresAt,
      },
    });

    const debugUrl = new URL('/verify-email', this.appConfiguration.appBaseUrl);
    debugUrl.searchParams.set('token', token);

    return {
      email,
      purpose: MagicLinkPurpose.VERIFY_EMAIL,
      expiresAt,
      ...(this.appConfiguration.isProduction
        ? {}
        : {
            debugToken: token,
            debugUrl: debugUrl.toString(),
          }),
    };
  }

  async verifyEmailMagicLink(
    dto: VerifyEmailMagicLinkDto,
  ): Promise<Record<string, unknown>> {
    const tokenHash = this.hashValue(dto.token.trim());
    const magicLink = await this.prisma.emailMagicLink.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
      },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!magicLink || magicLink.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Magic link is invalid or expired.');
    }

    if (
      magicLink.purpose !== MagicLinkPurpose.VERIFY_EMAIL ||
      !magicLink.userId ||
      !magicLink.user
    ) {
      throw new BadRequestException(
        'Only email verification magic links are supported in Phase 1.',
      );
    }

    const emailVerifiedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.emailMagicLink.update({
        where: { id: magicLink.id },
        data: {
          consumedAt: emailVerifiedAt,
        },
      }),
      this.prisma.user.update({
        where: { id: magicLink.userId },
        data: {
          email: magicLink.email,
          emailVerifiedAt,
        },
      }),
    ]);

    return {
      user: this.serializeUser(
        magicLink.user,
        this.resolveDefaultActiveRole(magicLink.user),
      ),
      emailVerifiedAt,
    };
  }

  async refreshTokens(
    user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    if (!user.refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const session = await this.getSessionOrThrow(user.sessionId, user.sub);

    if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh session is no longer active.');
    }

    if (session.refreshTokenHash !== this.hashValue(user.refreshToken)) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    const currentUser = await this.getUserOrThrow(user.sub);
    this.assertUserCanAuthenticate(currentUser);

    return this.issueTokensForExistingSession(
      currentUser,
      session,
      session.activeRole,
    );
  }

  async logout(
    user: AuthenticatedRequestUser,
  ): Promise<Record<string, boolean>> {
    await this.prisma.authSession.updateMany({
      where: {
        id: user.sessionId,
        userId: user.sub,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      loggedOut: true,
    };
  }

  async getSessionAwareProfile(
    userId: string,
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.getUserOrThrow(userId);
    const session = await this.getSessionOrThrow(sessionId, userId);

    return {
      user: this.serializeUser(user, session.activeRole),
    };
  }

  async reissueTokensForSession(
    userId: string,
    sessionId: string,
    activeRole: (typeof AppRole)[keyof typeof AppRole],
  ): Promise<Record<string, unknown>> {
    const user = await this.getUserOrThrow(userId);
    this.assertUserRole(user, activeRole);
    const session = await this.getSessionOrThrow(sessionId, userId);

    return this.issueTokensForExistingSession(user, session, activeRole);
  }

  private async registerUserFromOtp(
    otpRecord: OtpCode,
    dto: VerifyPhoneOtpDto,
  ): Promise<UserWithRoles> {
    const fullName = dto.fullName?.trim() || otpRecord.fullName?.trim();
    const email = dto.email ? this.normalizeEmail(dto.email) : otpRecord.email;

    if (!fullName || !email) {
      throw new BadRequestException(
        'Full name and email are required to register.',
      );
    }

    await this.assertRegisterableIdentity(otpRecord.phone, email);

    return this.prisma.user.create({
      data: {
        fullName,
        email,
        phone: otpRecord.phone,
        phoneVerifiedAt: new Date(),
        roles: {
          create: {
            role: AppRole.UCR,
          },
        },
      },
      include: {
        roles: true,
      },
    });
  }

  private async loginUserFromOtp(phone: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'No account exists for this phone number.',
      );
    }

    this.assertUserCanAuthenticate(user);

    return user;
  }

  private async createSessionResponse(
    user: UserWithRoles,
    metadata: RequestMetadata,
    activeRole: (typeof AppRole)[keyof typeof AppRole],
  ): Promise<Record<string, unknown>> {
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: '',
        deviceInfo: metadata.deviceInfo ?? null,
        ip: metadata.ip ?? null,
        expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
        activeRole,
      },
    });

    return this.issueTokensForExistingSession(user, session, activeRole);
  }

  private async issueTokensForExistingSession(
    user: UserWithRoles,
    session: AuthSessionRecord,
    activeRole: (typeof AppRole)[keyof typeof AppRole],
  ): Promise<Record<string, unknown>> {
    this.assertUserCanAuthenticate(user);
    this.assertUserRole(user, activeRole);

    const now = new Date();
    const tokenPayload = {
      sub: user.id,
      sessionId: session.id,
      roles: user.roles.map((role) => role.role),
      activeRole,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          ...tokenPayload,
          tokenType: JwtTokenType.ACCESS,
        },
        {
          secret: this.authConfiguration.accessSecret,
          expiresIn: this.authConfiguration.accessTtl,
        },
      ),
      this.jwtService.signAsync(
        {
          ...tokenPayload,
          tokenType: JwtTokenType.REFRESH,
        },
        {
          secret: this.authConfiguration.refreshSecret,
          expiresIn: this.authConfiguration.refreshTtl,
        },
      ),
    ]);

    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlMs);

    await this.prisma.authSession.update({
      where: {
        id: session.id,
      },
      data: {
        activeRole,
        refreshTokenHash: this.hashValue(refreshToken),
        expiresAt,
        lastUsedAt: now,
        revokedAt: null,
      },
    });

    return {
      user: this.serializeUser(user, activeRole),
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(now.getTime() + this.accessTokenTtlMs),
        refreshTokenExpiresAt: expiresAt,
      },
    };
  }

  private async getUserOrThrow(userId: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found.');
    }

    return user;
  }

  private async getSessionOrThrow(
    sessionId: string,
    userId: string,
  ): Promise<AuthSessionRecord> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Authentication session not found.');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException(
        'Authentication session has been revoked.',
      );
    }

    return session;
  }

  private serializeUser(
    user: UserWithRoles,
    activeRole: (typeof AppRole)[keyof typeof AppRole],
  ): Record<string, unknown> {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.roles.map((role) => role.role),
      activeRole,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      suspendedUntil: user.suspendedUntil,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private resolveDefaultActiveRole(
    user: Pick<UserWithRoles, 'roles'>,
  ): (typeof AppRole)[keyof typeof AppRole] {
    const availableRoles = user.roles.map((role) => role.role);

    if (availableRoles.includes(AppRole.UCR)) {
      return AppRole.UCR;
    }

    return availableRoles[0] ?? AppRole.UCR;
  }

  private assertUserCanAuthenticate(
    user: Pick<UserWithRoles, 'status' | 'suspendedUntil'>,
  ): void {
    if (user.status === UserStatus.CLOSED) {
      throw new ForbiddenException('This account has been closed.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      const suspendedUntil =
        user.suspendedUntil?.toISOString() ?? 'a later date';
      throw new ForbiddenException(
        `This account is suspended until ${suspendedUntil}.`,
      );
    }
  }

  private assertUserRole(
    user: Pick<UserWithRoles, 'roles'>,
    role: (typeof AppRole)[keyof typeof AppRole],
  ): void {
    const hasRole = user.roles.some((userRole) => userRole.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `The account does not have the ${role} role.`,
      );
    }
  }

  private async assertRegisterableIdentity(
    phone: string,
    email: string | null,
  ): Promise<void> {
    const [phoneOwner, emailOwner] = await Promise.all([
      this.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      }),
      email
        ? this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (phoneOwner) {
      throw new ConflictException(
        'A user already exists with this phone number.',
      );
    }

    if (emailOwner) {
      throw new ConflictException(
        'A user already exists with this email address.',
      );
    }
  }

  private hashValue(value: string): string {
    return createHmac('sha256', this.authConfiguration.hashSecret)
      .update(value)
      .digest('hex');
  }

  private generateOtpCode(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private normalizePhone(phone: string): string {
    return phone.trim();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}

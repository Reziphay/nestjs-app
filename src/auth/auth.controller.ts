import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RefreshTokenGuard } from '../common/guards/refresh-token.guard';
import type { AuthenticatedRequestUser } from '../common/types/authenticated-request-user.type';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { RequestEmailMagicLinkDto } from './dto/request-email-magic-link.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { VerifyEmailMagicLinkDto } from './dto/verify-email-magic-link.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request-phone-otp')
  requestPhoneOtp(
    @Body() dto: RequestPhoneOtpDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.requestPhoneOtp(dto);
  }

  @Public()
  @Post('verify-phone-otp')
  verifyPhoneOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Req() request: Request,
  ): Promise<Record<string, unknown>> {
    return this.authService.verifyPhoneOtp(dto, {
      deviceInfo: dto.deviceInfo ?? request.headers['user-agent'] ?? null,
      ip: request.ip ?? null,
    });
  }

  @Public()
  @Post('complete-registration')
  completeRegistration(
    @Body() dto: CompleteRegistrationDto,
    @Req() request: Request,
  ): Promise<Record<string, unknown>> {
    return this.authService.completeRegistration(dto, {
      deviceInfo: request.headers['user-agent'] ?? null,
      ip: request.ip ?? null,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('request-email-magic-link')
  requestEmailMagicLink(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: RequestEmailMagicLinkDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.requestEmailMagicLink(user.sub, dto);
  }

  @Public()
  @Post('verify-email-magic-link')
  verifyEmailMagicLink(
    @Body() dto: VerifyEmailMagicLinkDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.verifyEmailMagicLink(dto);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refresh(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.refreshTokens({
      ...user,
      refreshToken: user.refreshToken ?? dto.refreshToken,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, boolean>> {
    return this.authService.logout(user);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Record<string, unknown>> {
    return this.authService.getSessionAwareProfile(user.sub, user.sessionId);
  }
}

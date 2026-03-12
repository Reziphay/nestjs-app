import { Request } from 'express';
import { Controller, Get, Post, Query, Req, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthService } from 'src/modules/auth/auth.service';
import {
  LogoutDto,
  RefreshTokenDto,
  RequestEmailVerificationDto,
  RequestOtpDto,
  SwitchRoleDto,
  VerifyEmailTokenQueryDto,
  VerifyOtpDto,
} from 'src/modules/auth/dto/auth.dto';
import { AuthenticatedRequestUser } from 'src/modules/auth/auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @Public()
  @ApiOperation({ summary: 'Create an OTP login request' })
  requestOtp(@Body() dto: RequestOtpDto, @Req() request: Request) {
    return this.authService.requestOtp(dto, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
  }

  @Post('otp/verify')
  @Public()
  @ApiOperation({ summary: 'Verify OTP and create a session' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request) {
    return this.authService.verifyOtp(dto, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
  }

  @Post('email/verify/request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request an email verification link' })
  requestEmailVerification(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Body() dto: RequestEmailVerificationDto,
  ) {
    return this.authService.requestEmailVerification(auth.userId, dto);
  }

  @Get('email/verify')
  @Public()
  @ApiOperation({ summary: 'Verify email via token' })
  verifyEmail(@Query() query: VerifyEmailTokenQueryDto) {
    return this.authService.verifyEmailToken(query.token);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Rotate tokens using a refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return {
      tokens: await this.authService.refresh(dto.refreshToken),
    };
  }

  @Post('logout')
  @Public()
  @ApiOperation({ summary: 'Revoke a refresh token session' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentAuth() auth: AuthenticatedRequestUser) {
    return this.authService.getMe(auth.userId);
  }

  @Post('switch-role')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch active role for current account' })
  switchRole(
    @CurrentAuth() auth: AuthenticatedRequestUser,
    @Body() dto: SwitchRoleDto,
  ) {
    return this.authService.switchRole(auth.userId, dto);
  }

  private getUserAgent(request: Request): string | undefined {
    const header = request.headers['user-agent'];

    if (typeof header === 'string') {
      return header;
    }

    return Array.isArray(header) ? header[0] : undefined;
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { authConfig } from '../../config';
import { JwtTokenType } from '../../common/enums/jwt-token-type.enum';
import type { AuthenticatedRequestUser } from '../../common/types/authenticated-request-user.type';

type RefreshTokenRequest = Request & {
  body?: unknown;
};

function extractRefreshToken(request: Request): string | null {
  const typedRequest = request as RefreshTokenRequest;
  const body =
    typeof typedRequest.body === 'object' && typedRequest.body !== null
      ? (typedRequest.body as { refreshToken?: unknown })
      : undefined;
  const bodyToken =
    typeof body?.refreshToken === 'string' ? body.refreshToken : null;
  const headerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

  return bodyToken ?? (typeof headerToken === 'string' ? headerToken : null);
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(@Inject(authConfig.KEY) config: ConfigType<typeof authConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: config.refreshSecret,
    });
  }

  validate(
    request: Request,
    payload: AuthenticatedRequestUser,
  ): AuthenticatedRequestUser {
    const refreshToken = extractRefreshToken(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    if (payload.tokenType !== JwtTokenType.REFRESH) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}

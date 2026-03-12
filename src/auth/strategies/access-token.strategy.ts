import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { authConfig } from '../../config';
import { JwtTokenType } from '../../common/enums/jwt-token-type.enum';
import type { AuthenticatedRequestUser } from '../../common/types/authenticated-request-user.type';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(authConfig.KEY) config: ConfigType<typeof authConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
    });
  }

  validate(payload: AuthenticatedRequestUser): AuthenticatedRequestUser {
    if (payload.tokenType !== JwtTokenType.ACCESS) {
      throw new UnauthorizedException('Invalid access token.');
    }

    return payload;
  }
}

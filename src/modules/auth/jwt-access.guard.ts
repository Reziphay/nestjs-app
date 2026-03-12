import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SessionStatus } from '@prisma/client';

import { AppHttpException } from 'src/common/exceptions/app-http.exception';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  AccessTokenPayload,
  AuthenticatedRequest,
} from 'src/modules/auth/auth.types';

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Authentication token is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authorization.replace('Bearer ', '').trim();

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('auth.accessTokenSecret', {
          infer: true,
        }),
      });
    } catch {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Authentication token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.type !== 'access' || !payload.sub || !payload.sessionId) {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Authentication token is invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session = await this.prismaService.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.status !== SessionStatus.ACTIVE ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new AppHttpException(
        'UNAUTHORIZED',
        'Session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.auth = {
      userId: payload.sub,
      sessionId: payload.sessionId,
    };

    return true;
  }
}

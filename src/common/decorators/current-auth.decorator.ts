import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import {
  AuthenticatedRequest,
  AuthenticatedRequestUser,
} from 'src/modules/auth/auth.types';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.auth;
  },
);

import type { Request } from 'express';

import type { AuthenticatedRequestUser } from './authenticated-request-user.type';

export type RequestWithContext = Request & {
  requestId?: string;
  user?: AuthenticatedRequestUser;
};

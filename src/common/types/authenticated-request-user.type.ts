import type { AppRole } from '../enums/app-role.enum';
import type { JwtTokenType } from '../enums/jwt-token-type.enum';

export interface AuthenticatedRequestUser {
  sub: string;
  sessionId: string;
  roles: AppRole[];
  activeRole: AppRole;
  tokenType: JwtTokenType;
  refreshToken?: string;
}

import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type AccessTokenPayload = {
  sub: string;
  sessionId: string;
  type: 'access';
  iat?: number;
  exp?: number;
};

export type AuthenticatedRequestUser = {
  userId: string;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedRequestUser;
};

export type UserProfileDto = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  phoneNumber: string;
  roles: UserRole[];
  activeRole: UserRole;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  suspensionEndsAt: string | null;
  closedReason: string | null;
  verification: {
    phoneVerified: boolean;
    emailVerified: boolean;
    email: string | null;
    phoneNumber: string;
  };
  createdAt: string;
  updatedAt: string;
};

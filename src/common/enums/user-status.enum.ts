export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSED: 'CLOSED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

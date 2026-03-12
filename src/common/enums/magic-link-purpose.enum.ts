export const MagicLinkPurpose = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  LOGIN_EMAIL: 'LOGIN_EMAIL',
} as const;

export type MagicLinkPurpose =
  (typeof MagicLinkPurpose)[keyof typeof MagicLinkPurpose];

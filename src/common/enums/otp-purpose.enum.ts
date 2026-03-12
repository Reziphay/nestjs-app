export const OtpPurpose = {
  REGISTER: 'REGISTER',
  LOGIN: 'LOGIN',
  VERIFY_PHONE: 'VERIFY_PHONE',
  CHANGE_PHONE: 'CHANGE_PHONE',
} as const;

export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

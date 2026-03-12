export const JwtTokenType = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export type JwtTokenType = (typeof JwtTokenType)[keyof typeof JwtTokenType];

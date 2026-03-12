export const AppRole = {
  UCR: 'UCR',
  USO: 'USO',
  ADMIN: 'ADMIN',
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

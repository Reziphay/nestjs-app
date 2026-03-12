import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://reziphay:reziphay@localhost:5432/reziphay?schema=public',
  },
});

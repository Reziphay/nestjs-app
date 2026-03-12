export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'Reziphay API',
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
  },
  database: {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    name: process.env.MYSQL_DATABASE ?? 'reziphay',
    user: process.env.MYSQL_USER ?? 'reziphay',
    password: process.env.MYSQL_PASSWORD ?? 'reziphay',
    rootPassword: process.env.MYSQL_ROOT_PASSWORD ?? 'root',
    url:
      process.env.DATABASE_URL ??
      'mysql://reziphay:reziphay@127.0.0.1:3306/reziphay',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? '',
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  },
  auth: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTokenTtlMinutes: Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15),
    refreshTokenTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  },
});

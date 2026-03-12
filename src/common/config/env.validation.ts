import Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_NAME: Joi.string().default('Reziphay API'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  SWAGGER_PATH: Joi.string().default('api/docs'),
  MYSQL_HOST: Joi.string().hostname().default('127.0.0.1'),
  MYSQL_PORT: Joi.number().port().default(3306),
  MYSQL_DATABASE: Joi.string().default('reziphay'),
  MYSQL_USER: Joi.string().default('reziphay'),
  MYSQL_PASSWORD: Joi.string().allow('').default('reziphay'),
  MYSQL_ROOT_PASSWORD: Joi.string().allow('').default('root'),
  DATABASE_URL: Joi.string()
    .pattern(/^mysql:\/\/.+$/)
    .default('mysql://reziphay:reziphay@127.0.0.1:3306/reziphay'),
  REDIS_HOST: Joi.string().hostname().default('127.0.0.1'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_URL: Joi.string()
    .pattern(/^redis:\/\/.+$/)
    .default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: Joi.string().min(16).default('dev-access-secret'),
  JWT_REFRESH_SECRET: Joi.string().min(16).default('dev-refresh-secret'),
  JWT_ACCESS_TTL_MINUTES: Joi.number().positive().default(15),
  JWT_REFRESH_TTL_DAYS: Joi.number().positive().default(30),
});

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const { error, value } = envSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
  }

  return value as Record<string, unknown>;
}

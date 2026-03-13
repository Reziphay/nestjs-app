import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsOptional()
  @IsString()
  API_PREFIX?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_TTL!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  OTP_TTL_MINUTES!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  OTP_MAX_ATTEMPTS!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 7)
  MAGIC_LINK_TTL_MINUTES!: number;

  @IsString()
  @IsNotEmpty()
  AUTH_HASH_SECRET!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  RESERVATION_APPROVAL_TTL_MINUTES!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(,\d+)*$/)
  RESERVATION_REMINDER_LEAD_MINUTES?: string;

  @IsString()
  @IsNotEmpty()
  RESERVATION_QR_SECRET!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  RESERVATION_QR_TTL_MINUTES!: number;

  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  APP_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsOptional()
  @IsIn(['local', 's3'])
  STORAGE_DRIVER?: string;

  @IsOptional()
  @IsString()
  STORAGE_LOCAL_DIR?: string;

  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_KEY?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  S3_FORCE_PATH_STYLE?: boolean;

  @IsOptional()
  @IsString()
  FCM_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FCM_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[^]*$/)
  FCM_PRIVATE_KEY?: string;

  @IsOptional()
  @IsIn(['none', 'mapbox'])
  GEO_PROVIDER?: string;

  @IsOptional()
  @IsString()
  MAPBOX_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  MAPBOX_BASE_URL?: string;

  @IsOptional()
  @IsString()
  MAPBOX_DEFAULT_COUNTRY?: string;

  @IsOptional()
  @IsString()
  MAPBOX_DEFAULT_LANGUAGE?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (validatedConfig.STORAGE_DRIVER === 's3') {
    const missingS3Variables = [
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ].filter((key) => !validatedConfig[key as keyof EnvironmentVariables]);

    if (missingS3Variables.length > 0) {
      throw new Error(`S3 storage requires: ${missingS3Variables.join(', ')}.`);
    }
  }

  const hasAnyFcmConfig = Boolean(
    validatedConfig.FCM_PROJECT_ID ||
    validatedConfig.FCM_CLIENT_EMAIL ||
    validatedConfig.FCM_PRIVATE_KEY,
  );
  const hasCompleteFcmConfig = Boolean(
    validatedConfig.FCM_PROJECT_ID &&
    validatedConfig.FCM_CLIENT_EMAIL &&
    validatedConfig.FCM_PRIVATE_KEY,
  );

  if (hasAnyFcmConfig && !hasCompleteFcmConfig) {
    throw new Error(
      'FCM push delivery requires FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY.',
    );
  }

  if (
    validatedConfig.GEO_PROVIDER === 'mapbox' &&
    !validatedConfig.MAPBOX_ACCESS_TOKEN
  ) {
    throw new Error(
      'MAPBOX_ACCESS_TOKEN is required when GEO_PROVIDER=mapbox.',
    );
  }

  if (validatedConfig.RESERVATION_REMINDER_LEAD_MINUTES) {
    const invalidReminderLeadMinutes =
      validatedConfig.RESERVATION_REMINDER_LEAD_MINUTES.split(',').some(
        (value) => {
          const parsedValue = Number(value);

          return !Number.isInteger(parsedValue) || parsedValue < 1;
        },
      );

    if (invalidReminderLeadMinutes) {
      throw new Error(
        'RESERVATION_REMINDER_LEAD_MINUTES must contain positive integer minutes.',
      );
    }
  }

  return validatedConfig;
}

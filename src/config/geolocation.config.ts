import { registerAs } from '@nestjs/config';

export const geolocationConfig = registerAs('geolocation', () => ({
  provider: process.env['GEO_PROVIDER'] ?? 'none',
  mapbox: {
    accessToken: process.env['MAPBOX_ACCESS_TOKEN'] ?? '',
    baseUrl: process.env['MAPBOX_BASE_URL'] ?? 'https://api.mapbox.com',
    defaultCountry: process.env['MAPBOX_DEFAULT_COUNTRY'] ?? '',
    defaultLanguage: process.env['MAPBOX_DEFAULT_LANGUAGE'] ?? '',
  },
}));

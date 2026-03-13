import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { geolocationConfig } from '../config';
import { GEOLOCATION_PROVIDER } from './locations.constants';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { MapboxGeolocationProvider } from './mapbox-geolocation.provider';
import { NoopGeolocationProvider } from './noop-geolocation.provider';

@Module({
  controllers: [LocationsController],
  providers: [
    MapboxGeolocationProvider,
    NoopGeolocationProvider,
    {
      provide: GEOLOCATION_PROVIDER,
      inject: [
        geolocationConfig.KEY,
        NoopGeolocationProvider,
        MapboxGeolocationProvider,
      ],
      useFactory: (
        config: ConfigType<typeof geolocationConfig>,
        noopGeolocationProvider: NoopGeolocationProvider,
        mapboxGeolocationProvider: MapboxGeolocationProvider,
      ) =>
        config.provider === 'mapbox'
          ? mapboxGeolocationProvider
          : noopGeolocationProvider,
    },
    LocationsService,
  ],
})
export class LocationsModule {}

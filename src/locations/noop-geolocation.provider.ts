import { Injectable } from '@nestjs/common';

import type {
  GeocodedLocation,
  GeolocationProvider,
  GeolocationSearchInput,
  ReverseGeocodeInput,
} from './geolocation.types';

@Injectable()
export class NoopGeolocationProvider implements GeolocationProvider {
  searchLocations(input: GeolocationSearchInput): Promise<GeocodedLocation[]> {
    void input;
    return Promise.resolve([]);
  }

  reverseGeocode(input: ReverseGeocodeInput): Promise<GeocodedLocation[]> {
    void input;
    return Promise.resolve([]);
  }
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { GEOLOCATION_PROVIDER } from './locations.constants';
import type { GeolocationProvider } from './geolocation.types';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { SearchLocationsDto } from './dto/search-locations.dto';

@Injectable()
export class LocationsService {
  constructor(
    @Inject(GEOLOCATION_PROVIDER)
    private readonly geolocationProvider: GeolocationProvider,
  ) {}

  async searchLocations(
    query: SearchLocationsDto,
  ): Promise<Record<string, unknown>> {
    const hasOnlyOneProximityCoordinate =
      (query.proximityLat === undefined) !== (query.proximityLng === undefined);

    if (hasOnlyOneProximityCoordinate) {
      throw new BadRequestException(
        'Both proximityLat and proximityLng are required together.',
      );
    }

    const items = await this.geolocationProvider.searchLocations({
      query: query.q,
      country: query.country,
      language: query.language,
      limit: query.limit ?? 5,
      proximity:
        query.proximityLat !== undefined && query.proximityLng !== undefined
          ? {
              lat: query.proximityLat,
              lng: query.proximityLng,
            }
          : null,
    });

    return {
      items,
    };
  }

  async reverseGeocode(
    query: ReverseGeocodeDto,
  ): Promise<Record<string, unknown>> {
    const items = await this.geolocationProvider.reverseGeocode({
      lat: query.lat,
      lng: query.lng,
      language: query.language,
      limit: query.limit ?? 1,
    });

    return {
      items,
    };
  }
}

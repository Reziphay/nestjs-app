import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { geolocationConfig } from '../config';
import type {
  GeocodedLocation,
  GeolocationProvider,
  GeolocationSearchInput,
  ReverseGeocodeInput,
} from './geolocation.types';

type MapboxFeature = {
  id?: string;
  properties?: {
    mapbox_id?: string;
    full_address?: string;
    name?: string;
    place_formatted?: string;
    feature_type?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
    };
  };
  geometry?: {
    coordinates?: [number, number];
  };
  coordinates?: {
    longitude?: number;
    latitude?: number;
  };
  name?: string;
  place_formatted?: string;
  context?: {
    country?: {
      name?: string;
      country_code?: string;
    };
    place?: {
      name?: string;
    };
    locality?: {
      name?: string;
    };
    region?: {
      name?: string;
    };
    postcode?: {
      name?: string;
    };
  };
};

type MapboxGeocodingResponse = {
  features?: MapboxFeature[];
};

@Injectable()
export class MapboxGeolocationProvider implements GeolocationProvider {
  constructor(
    @Inject(geolocationConfig.KEY)
    private readonly geolocationConfiguration: ConfigType<
      typeof geolocationConfig
    >,
  ) {}

  async searchLocations(
    input: GeolocationSearchInput,
  ): Promise<GeocodedLocation[]> {
    const params = new URLSearchParams({
      q: input.query.trim(),
      access_token: this.geolocationConfiguration.mapbox.accessToken,
      autocomplete: 'true',
      limit: String(input.limit),
      types: 'address,street,neighborhood,locality,place',
    });

    if (input.country || this.geolocationConfiguration.mapbox.defaultCountry) {
      params.set(
        'country',
        input.country?.trim() ||
          this.geolocationConfiguration.mapbox.defaultCountry,
      );
    }

    if (
      input.language ||
      this.geolocationConfiguration.mapbox.defaultLanguage
    ) {
      params.set(
        'language',
        input.language?.trim() ||
          this.geolocationConfiguration.mapbox.defaultLanguage,
      );
    }

    if (input.proximity) {
      params.set('proximity', `${input.proximity.lng},${input.proximity.lat}`);
    }

    const response = await this.request(`/search/geocode/v6/forward?${params}`);
    return (response.features ?? []).map((feature) =>
      this.serializeFeature(feature),
    );
  }

  async reverseGeocode(
    input: ReverseGeocodeInput,
  ): Promise<GeocodedLocation[]> {
    const params = new URLSearchParams({
      longitude: String(input.lng),
      latitude: String(input.lat),
      access_token: this.geolocationConfiguration.mapbox.accessToken,
      limit: String(input.limit),
      types: 'address',
    });

    if (
      input.language ||
      this.geolocationConfiguration.mapbox.defaultLanguage
    ) {
      params.set(
        'language',
        input.language?.trim() ||
          this.geolocationConfiguration.mapbox.defaultLanguage,
      );
    }

    const response = await this.request(`/search/geocode/v6/reverse?${params}`);
    return (response.features ?? []).map((feature) =>
      this.serializeFeature(feature),
    );
  }

  private async request(path: string): Promise<MapboxGeocodingResponse> {
    const response = await fetch(
      `${this.geolocationConfiguration.mapbox.baseUrl}${path}`,
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Geolocation provider request failed with status ${response.status}.`,
      );
    }

    return (await response.json()) as MapboxGeocodingResponse;
  }

  private serializeFeature(feature: MapboxFeature): GeocodedLocation {
    const coordinates =
      feature.properties?.coordinates ??
      feature.coordinates ??
      (feature.geometry?.coordinates
        ? {
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
          }
        : undefined);
    const fullAddress =
      feature.properties?.full_address ??
      [
        feature.properties?.name ?? feature.name ?? null,
        feature.properties?.place_formatted ?? feature.place_formatted ?? null,
      ]
        .filter(Boolean)
        .join(', ');

    return {
      provider: 'mapbox',
      placeId:
        feature.properties?.mapbox_id ?? feature.id ?? `${fullAddress}-unknown`,
      name: feature.properties?.name ?? feature.name ?? fullAddress,
      fullAddress,
      country: feature.context?.country?.name ?? null,
      city:
        feature.context?.place?.name ?? feature.context?.locality?.name ?? null,
      region: feature.context?.region?.name ?? null,
      postcode: feature.context?.postcode?.name ?? null,
      lat: coordinates?.latitude ?? null,
      lng: coordinates?.longitude ?? null,
      featureType: feature.properties?.feature_type ?? null,
    };
  }
}

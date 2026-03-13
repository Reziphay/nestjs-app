export type GeolocationSearchInput = {
  query: string;
  country?: string;
  language?: string;
  limit: number;
  proximity?: {
    lat: number;
    lng: number;
  } | null;
};

export type ReverseGeocodeInput = {
  lat: number;
  lng: number;
  language?: string;
  limit: number;
};

export type GeocodedLocation = {
  provider: string;
  placeId: string;
  name: string;
  fullAddress: string;
  country: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  featureType: string | null;
};

export interface GeolocationProvider {
  searchLocations(input: GeolocationSearchInput): Promise<GeocodedLocation[]>;
  reverseGeocode(input: ReverseGeocodeInput): Promise<GeocodedLocation[]>;
}

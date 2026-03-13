import { MapboxGeolocationProvider } from './mapbox-geolocation.provider';

describe('MapboxGeolocationProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses forward geocoding results from Mapbox', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        features: [
          {
            id: 'feature-1',
            properties: {
              mapbox_id: 'mbx.1',
              name: 'Studio Reziphay',
              full_address: '123 Demo Street, Baku, Azerbaijan',
              feature_type: 'address',
              coordinates: {
                longitude: 49.8671,
                latitude: 40.4093,
              },
            },
            context: {
              country: {
                name: 'Azerbaijan',
              },
              place: {
                name: 'Baku',
              },
              region: {
                name: 'Baku',
              },
            },
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new MapboxGeolocationProvider({
      provider: 'mapbox',
      mapbox: {
        accessToken: 'token',
        baseUrl: 'https://api.mapbox.com',
        defaultCountry: 'az',
        defaultLanguage: 'en',
      },
    } as never);

    const result = await provider.searchLocations({
      query: 'Studio Reziphay',
      limit: 5,
      proximity: {
        lat: 40.4093,
        lng: 49.8671,
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/geocode/v6/forward?'),
    );
    expect(result).toEqual([
      {
        provider: 'mapbox',
        placeId: 'mbx.1',
        name: 'Studio Reziphay',
        fullAddress: '123 Demo Street, Baku, Azerbaijan',
        country: 'Azerbaijan',
        city: 'Baku',
        region: 'Baku',
        postcode: null,
        lat: 40.4093,
        lng: 49.8671,
        featureType: 'address',
      },
    ]);
  });
});

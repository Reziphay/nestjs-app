/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { BadRequestException } from '@nestjs/common';

import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  it('rejects partial proximity coordinates', async () => {
    const service = new LocationsService({
      searchLocations: jest.fn(),
      reverseGeocode: jest.fn(),
    } as any);

    await expect(
      service.searchLocations({
        q: 'Baku',
        proximityLat: 40.4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns provider results for location search', async () => {
    const searchLocations = jest.fn().mockResolvedValue([
      {
        provider: 'mapbox',
        placeId: 'place-1',
        name: 'Studio Reziphay',
        fullAddress: '123 Demo Street, Baku',
        country: 'Azerbaijan',
        city: 'Baku',
        region: 'Baku',
        postcode: null,
        lat: 40.4093,
        lng: 49.8671,
        featureType: 'address',
      },
    ]);

    const service = new LocationsService({
      searchLocations,
      reverseGeocode: jest.fn(),
    } as any);

    const result = await service.searchLocations({
      q: 'Studio Reziphay',
      limit: 5,
      proximityLat: 40.4093,
      proximityLng: 49.8671,
    });

    expect(searchLocations).toHaveBeenCalledWith({
      query: 'Studio Reziphay',
      country: undefined,
      language: undefined,
      limit: 5,
      proximity: {
        lat: 40.4093,
        lng: 49.8671,
      },
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          placeId: 'place-1',
          city: 'Baku',
        }),
      ],
    });
  });
});

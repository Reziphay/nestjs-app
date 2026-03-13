/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ApprovalMode, ServiceType } from '@prisma/client';

import { SearchService } from './search.service';

describe('SearchService', () => {
  it('sorts discovery results by distance when coordinates are provided', async () => {
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-near',
        name: 'Near Cut',
        description: null,
        category: null,
        address: {
          id: 'address-1',
          label: 'Near Studio',
          fullAddress: '1 Near Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4093,
          lng: 49.8671,
        },
        ratingStat: {
          avgRating: 4.2,
          reviewCount: 5,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-1',
          fullName: 'Near Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        priceAmount: 25,
        priceCurrency: 'AZN',
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      {
        id: 'service-far',
        name: 'Far Cut',
        description: null,
        category: null,
        address: {
          id: 'address-2',
          label: 'Far Studio',
          fullAddress: '99 Far Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.5001,
          lng: 49.9901,
        },
        ratingStat: {
          avgRating: 5,
          reviewCount: 20,
        },
        visibilityAssignments: [
          {
            id: 'assignment-1',
            startsAt: new Date('2026-03-01T00:00:00.000Z'),
            endsAt: null,
            label: {
              id: 'label-1',
              name: 'Sponsored',
              slug: 'sponsored',
              targetType: 'SERVICE',
              priority: 100,
            },
          },
        ],
        ownerUser: {
          id: 'owner-2',
          fullName: 'Far Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.AUTO,
        priceAmount: 40,
        priceCurrency: 'AZN',
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const prisma = {
      service: {
        findMany: serviceFindMany,
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new SearchService(prisma);

    const result = await service.searchDiscovery({
      lat: 40.4093,
      lng: 49.8671,
      limit: 10,
    });

    expect(serviceFindMany).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        services: [
          expect.objectContaining({
            id: 'service-near',
            distanceKm: 0,
          }),
          expect.objectContaining({
            id: 'service-far',
            visibilityPriority: 100,
          }),
        ],
        brands: [],
        providers: [],
      }),
    );
  });
});

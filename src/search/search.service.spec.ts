/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ApprovalMode, ServiceType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import { SearchSortMode } from './dto/search-discovery.dto';
import { SearchService } from './search.service';

describe('SearchService', () => {
  it('uses ranked text hits when q is provided across discovery entities', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'service-ranked-first',
          relevance_score: 42.5,
        },
        {
          id: 'service-ranked-second',
          relevance_score: 12.1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'brand-ranked-first',
          relevance_score: 30.4,
        },
        {
          id: 'brand-ranked-second',
          relevance_score: 9.7,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'provider-ranked-first',
          relevance_score: 27.2,
        },
        {
          id: 'provider-ranked-second',
          relevance_score: 11.8,
        },
      ]);

    const service = new SearchService({
      $queryRaw: queryRaw,
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'service-ranked-second',
            name: 'Budget Trim',
            description: null,
            category: null,
            address: null,
            ratingStat: null,
            popularityStat: null,
            visibilityAssignments: [],
            ownerUser: {
              id: 'owner-2',
              fullName: 'Second Owner',
              serviceOwnerRatingStat: null,
              serviceOwnerPopularityStat: null,
              visibilityAssignments: [],
            },
            brand: null,
            serviceType: ServiceType.SOLO,
            approvalMode: ApprovalMode.MANUAL,
            priceAmount: 20,
            priceCurrency: 'AZN',
            availabilityRules: [],
            availabilityExceptions: [],
            manualBlocks: [],
            createdAt: new Date('2026-03-13T09:00:00.000Z'),
          },
          {
            id: 'service-ranked-first',
            name: 'Premium Barber',
            description: null,
            category: null,
            address: null,
            ratingStat: null,
            popularityStat: null,
            visibilityAssignments: [],
            ownerUser: {
              id: 'owner-1',
              fullName: 'First Owner',
              serviceOwnerRatingStat: null,
              serviceOwnerPopularityStat: null,
              visibilityAssignments: [],
            },
            brand: null,
            serviceType: ServiceType.SOLO,
            approvalMode: ApprovalMode.AUTO,
            priceAmount: 35,
            priceCurrency: 'AZN',
            availabilityRules: [],
            availabilityExceptions: [],
            manualBlocks: [],
            createdAt: new Date('2026-03-13T10:00:00.000Z'),
          },
        ]),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'brand-ranked-second',
            name: 'Second Studio',
            description: null,
            owner: {
              id: 'brand-owner-2',
              fullName: 'Brand Owner Two',
              serviceOwnerRatingStat: null,
              serviceOwnerPopularityStat: null,
              visibilityAssignments: [],
            },
            addresses: [],
            brandRatingStat: null,
            brandPopularityStat: null,
            visibilityAssignments: [],
            createdAt: new Date('2026-03-13T08:00:00.000Z'),
          },
          {
            id: 'brand-ranked-first',
            name: 'Premium Studio',
            description: null,
            owner: {
              id: 'brand-owner-1',
              fullName: 'Brand Owner One',
              serviceOwnerRatingStat: null,
              serviceOwnerPopularityStat: null,
              visibilityAssignments: [],
            },
            addresses: [],
            brandRatingStat: null,
            brandPopularityStat: null,
            visibilityAssignments: [],
            createdAt: new Date('2026-03-13T09:00:00.000Z'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'provider-ranked-second',
            fullName: 'Second Provider',
            serviceOwnerRatingStat: null,
            serviceOwnerPopularityStat: null,
            visibilityAssignments: [],
            services: [],
            ownedBrands: [],
            createdAt: new Date('2026-03-13T08:00:00.000Z'),
          },
          {
            id: 'provider-ranked-first',
            fullName: 'Premium Provider',
            serviceOwnerRatingStat: null,
            serviceOwnerPopularityStat: null,
            visibilityAssignments: [],
            services: [],
            ownedBrands: [],
            createdAt: new Date('2026-03-13T09:00:00.000Z'),
          },
        ]),
      },
    } as any);

    const result = await service.searchDiscovery({
      q: 'premium barber',
      limit: 10,
    });

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(result).toEqual(
      expect.objectContaining({
        services: [
          expect.objectContaining({
            id: 'service-ranked-first',
          }),
          expect.objectContaining({
            id: 'service-ranked-second',
          }),
        ],
        brands: [
          expect.objectContaining({
            id: 'brand-ranked-first',
          }),
          expect.objectContaining({
            id: 'brand-ranked-second',
          }),
        ],
        providers: [
          expect.objectContaining({
            id: 'provider-ranked-first',
          }),
          expect.objectContaining({
            id: 'provider-ranked-second',
          }),
        ],
      }),
    );
  });

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

  it('prioritizes available services when a requested availability window is provided', async () => {
    const requestedStartAt = '2026-03-16T10:00:00.000Z';
    const requestedEndAt = '2026-03-16T10:30:00.000Z';
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-near-blocked',
        name: 'Blocked Nearby Cut',
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
          avgRating: 4.8,
          reviewCount: 21,
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
        availabilityRules: [
          {
            id: 'rule-1',
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '18:00',
            isActive: true,
          },
        ],
        availabilityExceptions: [],
        manualBlocks: [
          {
            id: 'manual-block-1',
            startsAt: new Date('2026-03-16T09:45:00.000Z'),
            endsAt: new Date('2026-03-16T10:45:00.000Z'),
          },
        ],
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      {
        id: 'service-far-open',
        name: 'Open Far Cut',
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
          avgRating: 4.1,
          reviewCount: 5,
        },
        visibilityAssignments: [],
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
        availabilityRules: [
          {
            id: 'rule-2',
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '18:00',
            isActive: true,
          },
        ],
        availabilityExceptions: [],
        manualBlocks: [],
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const reservationFindMany = jest.fn().mockResolvedValue([]);

    const service = new SearchService({
      service: {
        findMany: serviceFindMany,
      },
      reservation: {
        findMany: reservationFindMany,
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const result = await service.searchDiscovery({
      lat: 40.4093,
      lng: 49.8671,
      requestedStartAt,
      requestedEndAt,
      limit: 10,
    });

    expect(serviceFindMany).toHaveBeenCalled();
    expect(reservationFindMany).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        services: [
          expect.objectContaining({
            id: 'service-far-open',
            availability: expect.objectContaining({
              isAvailable: true,
              reasonCode: null,
            }),
          }),
          expect.objectContaining({
            id: 'service-near-blocked',
            availability: expect.objectContaining({
              isAvailable: false,
              reasonCode: 'MANUAL_BLOCK',
            }),
          }),
        ],
      }),
    );
  });

  it('filters unavailable services when availableOnly is true', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'service-unavailable',
        exact_distance_km: 0.6,
      },
      {
        id: 'service-available',
        exact_distance_km: 1.2,
      },
    ]);
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-available',
        name: 'Available Cut',
        description: null,
        category: null,
        address: {
          id: 'address-1',
          label: 'Open Studio',
          fullAddress: '1 Open Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4093,
          lng: 49.8671,
        },
        ratingStat: {
          avgRating: 4.5,
          reviewCount: 10,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-1',
          fullName: 'Open Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        priceAmount: 30,
        priceCurrency: 'AZN',
        availabilityRules: [
          {
            id: 'rule-1',
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '18:00',
            isActive: true,
          },
        ],
        availabilityExceptions: [],
        manualBlocks: [],
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      {
        id: 'service-unavailable',
        name: 'Unavailable Cut',
        description: null,
        category: null,
        address: {
          id: 'address-2',
          label: 'Closed Studio',
          fullAddress: '2 Closed Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4193,
          lng: 49.8771,
        },
        ratingStat: {
          avgRating: 4.9,
          reviewCount: 40,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-2',
          fullName: 'Closed Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.AUTO,
        priceAmount: 45,
        priceCurrency: 'AZN',
        availabilityRules: [],
        availabilityExceptions: [],
        manualBlocks: [],
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const service = new SearchService({
      $queryRaw: queryRaw,
      service: {
        findMany: serviceFindMany,
      },
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const result = await service.listNearbyServices({
      lat: 40.4093,
      lng: 49.8671,
      requestedStartAt: '2026-03-16T10:00:00.000Z',
      requestedEndAt: '2026-03-16T10:30:00.000Z',
      availableOnly: true,
      limit: 10,
    });

    expect(result).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'service-available',
            availability: expect.objectContaining({
              isAvailable: true,
            }),
          }),
        ],
        pageInfo: expect.objectContaining({
          hasMore: false,
          nextCursor: null,
          limit: 10,
        }),
      }),
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('sorts service discovery by low price when sortBy=PRICE_LOW', async () => {
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-cheap',
        name: 'Cheap Cut',
        description: null,
        category: null,
        address: {
          id: 'address-1',
          label: 'Cheap Studio',
          fullAddress: '1 Cheap Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.5001,
          lng: 49.9901,
        },
        ratingStat: {
          avgRating: 4.1,
          reviewCount: 4,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-1',
          fullName: 'Cheap Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        priceAmount: 15,
        priceCurrency: 'AZN',
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
      {
        id: 'service-expensive',
        name: 'Expensive Cut',
        description: null,
        category: null,
        address: {
          id: 'address-2',
          label: 'Premium Studio',
          fullAddress: '2 Premium Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4093,
          lng: 49.8671,
        },
        ratingStat: {
          avgRating: 5,
          reviewCount: 50,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-2',
          fullName: 'Premium Owner',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.AUTO,
        priceAmount: 60,
        priceCurrency: 'AZN',
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
    ]);

    const service = new SearchService({
      service: {
        findMany: serviceFindMany,
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const result = await service.searchDiscovery({
      lat: 40.4093,
      lng: 49.8671,
      sortBy: SearchSortMode.PRICE_LOW,
      limit: 10,
    });

    expect(result).toEqual(
      expect.objectContaining({
        services: [
          expect.objectContaining({
            id: 'service-cheap',
            priceAmount: 15,
          }),
          expect.objectContaining({
            id: 'service-expensive',
            priceAmount: 60,
          }),
        ],
      }),
    );
  });

  it('sorts service discovery by popularity when sortBy=POPULARITY', async () => {
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-less-popular',
        name: 'Less Popular Cut',
        description: null,
        category: null,
        address: null,
        ratingStat: {
          avgRating: 5,
          reviewCount: 50,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-1',
          fullName: 'Owner One',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        priceAmount: 25,
        priceCurrency: 'AZN',
        popularityStat: {
          popularityScore: 3,
        },
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      {
        id: 'service-more-popular',
        name: 'More Popular Cut',
        description: null,
        category: null,
        address: null,
        ratingStat: {
          avgRating: 4.2,
          reviewCount: 3,
        },
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-2',
          fullName: 'Owner Two',
          serviceOwnerRatingStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.AUTO,
        priceAmount: 35,
        priceCurrency: 'AZN',
        popularityStat: {
          popularityScore: 20,
        },
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const service = new SearchService({
      service: {
        findMany: serviceFindMany,
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const result = await service.searchDiscovery({
      sortBy: SearchSortMode.POPULARITY,
      limit: 10,
    });

    expect(result).toEqual(
      expect.objectContaining({
        services: [
          expect.objectContaining({
            id: 'service-more-popular',
          }),
          expect.objectContaining({
            id: 'service-less-popular',
          }),
        ],
      }),
    );
  });

  it('requires coordinates for the nearby services endpoint', async () => {
    const service = new SearchService({
      service: {
        findMany: jest.fn(),
      },
      brand: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    } as any);

    await expect(
      service.listNearbyServices({ limit: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires coordinates when sortBy=PROXIMITY', async () => {
    const service = new SearchService({
      service: {
        findMany: jest.fn(),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    await expect(
      service.searchDiscovery({
        sortBy: SearchSortMode.PROXIMITY,
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires requestedStartAt when availableOnly is true', async () => {
    const service = new SearchService({
      service: {
        findMany: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    await expect(
      service.searchDiscovery({
        availableOnly: true,
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires requestedStartAt when sortBy=AVAILABILITY', async () => {
    const service = new SearchService({
      service: {
        findMany: jest.fn(),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    await expect(
      service.searchDiscovery({
        sortBy: SearchSortMode.AVAILABILITY,
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds DB-side geo bounds when radiusKm is provided', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);

    const service = new SearchService({
      $queryRaw: queryRaw,
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    await service.listNearbyServices({
      lat: 40.4093,
      lng: 49.8671,
      radiusKm: 5,
      limit: 10,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const rawCalls = queryRaw.mock.calls as Array<
      [{ strings?: string[] } | undefined]
    >;
    const rawSql = rawCalls[0]?.[0]?.strings?.join(' ');
    expect(rawSql).toContain('earth_distance');
    expect(rawSql).toContain('sa.lat between');
  });

  it('returns cursor page info for nearby services', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'service-first',
        exact_distance_km: 0.2,
      },
      {
        id: 'service-second',
        exact_distance_km: 1.4,
      },
    ]);
    const serviceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'service-first',
        name: 'First Cut',
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
        ratingStat: null,
        popularityStat: null,
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-1',
          fullName: 'First Owner',
          serviceOwnerRatingStat: null,
          serviceOwnerPopularityStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        priceAmount: 25,
        priceCurrency: 'AZN',
        availabilityRules: [],
        availabilityExceptions: [],
        manualBlocks: [],
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      {
        id: 'service-second',
        name: 'Second Cut',
        description: null,
        category: null,
        address: {
          id: 'address-2',
          label: 'Far Studio',
          fullAddress: '2 Far Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4193,
          lng: 49.8771,
        },
        ratingStat: null,
        popularityStat: null,
        visibilityAssignments: [],
        ownerUser: {
          id: 'owner-2',
          fullName: 'Second Owner',
          serviceOwnerRatingStat: null,
          serviceOwnerPopularityStat: null,
          visibilityAssignments: [],
        },
        brand: null,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.AUTO,
        priceAmount: 35,
        priceCurrency: 'AZN',
        availabilityRules: [],
        availabilityExceptions: [],
        manualBlocks: [],
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const service = new SearchService({
      $queryRaw: queryRaw,
      service: {
        findMany: serviceFindMany,
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const firstPage = await service.listNearbyServices({
      lat: 40.4093,
      lng: 49.8671,
      limit: 1,
    });

    expect(firstPage).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'service-first' })],
        pageInfo: expect.objectContaining({
          hasMore: true,
          nextCursor: expect.any(String),
          limit: 1,
        }),
      }),
    );

    const nextCursor = (
      firstPage as {
        pageInfo: {
          nextCursor: string;
        };
      }
    ).pageInfo.nextCursor;

    const secondPage = await service.listNearbyServices({
      lat: 40.4093,
      lng: 49.8671,
      limit: 1,
      cursor: nextCursor,
    });

    expect(secondPage).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'service-second' })],
        pageInfo: expect.objectContaining({
          hasMore: false,
          nextCursor: null,
          limit: 1,
        }),
      }),
    );
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('returns direct provider discovery items for service-owner listings', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'owner-1',
        relevance_score: 18.2,
        exact_distance_km: 0.55,
      },
    ]);
    const userFindMany = jest.fn().mockResolvedValue([
      {
        id: 'owner-1',
        fullName: 'Demo Owner',
        serviceOwnerRatingStat: {
          avgRating: 4.8,
          reviewCount: 12,
        },
        serviceOwnerPopularityStat: null,
        visibilityAssignments: [],
        services: [
          {
            id: 'service-1',
            name: 'Classic Haircut',
            brandId: null,
            categoryId: null,
            serviceType: ServiceType.SOLO,
            approvalMode: ApprovalMode.MANUAL,
            address: {
              id: 'address-1',
              label: 'Main',
              fullAddress: '1 Demo Street',
              country: 'Azerbaijan',
              city: 'Baku',
              lat: 40.4093,
              lng: 49.8671,
            },
            brand: null,
          },
        ],
        ownedBrands: [],
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
    ]);

    const service = new SearchService({
      $queryRaw: queryRaw,
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: userFindMany,
      },
    } as any);

    const result = await service.listServiceOwners({
      q: 'Demo',
      lat: 40.4093,
      lng: 49.8671,
      limit: 10,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(userFindMany).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'owner-1',
            name: 'Demo Owner',
            distanceKm: 0.55,
          }),
        ],
        pageInfo: expect.objectContaining({
          hasMore: false,
          nextCursor: null,
          limit: 10,
        }),
      }),
    );
  });
});

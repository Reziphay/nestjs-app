import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppRole,
  BrandStatus,
  Prisma,
  ReservationStatus,
  ServiceType,
  UserStatus,
} from '@prisma/client';

import { calculateDistanceKm } from '../common/utils/geo.util';
import {
  getMaxActiveVisibilityPriority,
  serializeActiveVisibilityLabels,
} from '../common/utils/visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  doReservationWindowsConflict,
  formatUtcTime,
  getDayOfWeekFromUtc,
  isReservationWindowInsideTimeRange,
  isSameUtcDate,
} from '../reservations/reservation-time.util';
import { SearchDiscoveryDto, SearchSortMode } from './dto/search-discovery.dto';

const activeVisibilityLabelInclude = {
  where: {
    label: {
      isActive: true,
    },
  },
  include: {
    label: {
      select: {
        id: true,
        name: true,
        slug: true,
        targetType: true,
        priority: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc' as const,
  },
};

const serviceSearchInclude = {
  ownerUser: {
    select: {
      id: true,
      fullName: true,
      serviceOwnerRatingStat: {
        select: {
          avgRating: true,
          reviewCount: true,
        },
      },
      serviceOwnerPopularityStat: {
        select: {
          popularityScore: true,
        },
      },
      visibilityAssignments: activeVisibilityLabelInclude,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      status: true,
      brandRatingStat: {
        select: {
          avgRating: true,
          reviewCount: true,
        },
      },
      brandPopularityStat: {
        select: {
          popularityScore: true,
        },
      },
      visibilityAssignments: activeVisibilityLabelInclude,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  address: true,
  ratingStat: {
    select: {
      avgRating: true,
      reviewCount: true,
    },
  },
  popularityStat: {
    select: {
      popularityScore: true,
    },
  },
  availabilityRules: {
    where: {
      isActive: true,
    },
    orderBy: [
      {
        dayOfWeek: 'asc' as const,
      },
      {
        startTime: 'asc' as const,
      },
    ],
  },
  availabilityExceptions: {
    orderBy: {
      date: 'asc' as const,
    },
  },
  manualBlocks: {
    orderBy: {
      startsAt: 'asc' as const,
    },
  },
  visibilityAssignments: activeVisibilityLabelInclude,
} satisfies Prisma.ServiceInclude;

const brandSearchInclude = {
  owner: {
    select: {
      id: true,
      fullName: true,
      serviceOwnerRatingStat: {
        select: {
          avgRating: true,
          reviewCount: true,
        },
      },
      serviceOwnerPopularityStat: {
        select: {
          popularityScore: true,
        },
      },
      visibilityAssignments: activeVisibilityLabelInclude,
    },
  },
  addresses: {
    where: {
      isPrimary: true,
    },
    take: 1,
  },
  brandRatingStat: {
    select: {
      avgRating: true,
      reviewCount: true,
    },
  },
  brandPopularityStat: {
    select: {
      popularityScore: true,
    },
  },
  visibilityAssignments: activeVisibilityLabelInclude,
} satisfies Prisma.BrandInclude;

const providerSearchInclude = {
  serviceOwnerRatingStat: {
    select: {
      avgRating: true,
      reviewCount: true,
    },
  },
  serviceOwnerPopularityStat: {
    select: {
      popularityScore: true,
    },
  },
  visibilityAssignments: activeVisibilityLabelInclude,
  services: {
    where: {
      isActive: true,
    },
    take: 3,
    orderBy: {
      createdAt: 'desc' as const,
    },
    select: {
      id: true,
      name: true,
      brandId: true,
      categoryId: true,
      serviceType: true,
      approvalMode: true,
      address: {
        select: {
          id: true,
          label: true,
          fullAddress: true,
          country: true,
          city: true,
          lat: true,
          lng: true,
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  ownedBrands: {
    where: {
      status: BrandStatus.ACTIVE,
    },
    take: 3,
    orderBy: {
      createdAt: 'desc' as const,
    },
    select: {
      id: true,
      name: true,
      addresses: {
        where: {
          isPrimary: true,
        },
        take: 1,
      },
    },
  },
} satisfies Prisma.UserInclude;

type ServiceSearchRecord = Prisma.ServiceGetPayload<{
  include: typeof serviceSearchInclude;
}>;

type BrandSearchRecord = Prisma.BrandGetPayload<{
  include: typeof brandSearchInclude;
}>;

type ProviderSearchRecord = Prisma.UserGetPayload<{
  include: typeof providerSearchInclude;
}>;

type RequestedAvailabilityWindow = {
  requestedStartAt: Date;
  requestedEndAt: Date | null;
};

type ServiceAvailabilityReasonCode =
  | 'MANUAL_BLOCK'
  | 'EXCEPTION_CLOSED'
  | 'OUTSIDE_EXCEPTION_HOURS'
  | 'DAY_UNAVAILABLE'
  | 'OUTSIDE_RULE_HOURS'
  | 'SOLO_CONFLICT';

type ServiceAvailabilitySnapshot = {
  isAvailable: boolean;
  reasonCode: ServiceAvailabilityReasonCode | null;
  reason: string | null;
  requestedStartAt: Date;
  requestedEndAt: Date | null;
};

type DiscoveryEntityKind = 'service' | 'brand' | 'provider';
type PopularityScoreMap = Map<string, number>;
type RelevanceScoreMap = Map<string, number>;

type RankedSearchHit = {
  id: string;
  relevanceScore: number;
};

type SearchResultPage<T> = {
  records: T[];
  relevanceScores: RelevanceScoreMap | null;
};

type GeoBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type DiscoveryPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

type DiscoveryPage<T> = {
  items: T[];
  pageInfo: DiscoveryPageInfo;
};

type DiscoveryCursorPayload = {
  offset: number;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async listNearbyServices(
    query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    const coordinates = this.resolveRequiredCoordinates(query);
    const page = await this.getDiscoveryServices(query, coordinates);

    return {
      items: page.items,
      pageInfo: page.pageInfo,
    };
  }

  async listServiceOwners(
    query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    const coordinates = this.resolveCoordinates(query);
    const page = await this.getDiscoveryProviders(query, coordinates);

    return {
      items: page.items,
      pageInfo: page.pageInfo,
    };
  }

  async searchDiscovery(
    query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    const coordinates = this.resolveCoordinates(query);
    const [servicesPage, brandsPage, providersPage] = await Promise.all([
      this.getDiscoveryServices(query, coordinates),
      this.getDiscoveryBrands(query, coordinates),
      this.getDiscoveryProviders(query, coordinates),
    ]);

    return {
      services: servicesPage.items,
      servicesPageInfo: servicesPage.pageInfo,
      brands: brandsPage.items,
      brandsPageInfo: brandsPage.pageInfo,
      providers: providersPage.items,
      providersPageInfo: providersPage.pageInfo,
    };
  }

  private async getDiscoveryServices(
    query: SearchDiscoveryDto,
    coordinates: { lat: number; lng: number } | null,
  ): Promise<DiscoveryPage<DiscoveryItem>> {
    const now = new Date();
    const limit = query.limit ?? 10;
    const cursorOffset = this.resolveCursorOffset(query.cursor);
    const sortMode = this.resolveSortMode(query, 'service');
    const requestedAvailability = this.resolveRequestedAvailability(query);
    const geoBounds = this.resolveGeoBounds(query, coordinates);
    this.assertSortRequirements(sortMode, coordinates, requestedAvailability);
    const serviceSearchResult = await this.searchServices(
      query,
      this.resolveFetchTake(limit, cursorOffset, requestedAvailability ? 6 : 3),
      geoBounds,
    );
    const services = serviceSearchResult.records;
    const availabilitySnapshots = await this.buildServiceAvailabilitySnapshots(
      services,
      requestedAvailability,
    );
    const popularityScores =
      sortMode === SearchSortMode.POPULARITY
        ? new Map(
            services.map((service) => [
              service.id,
              service.popularityStat?.popularityScore ?? 0,
            ]),
          )
        : null;

    const items = this.sortDiscoveryItems(
      services
        .map((service) =>
          this.serializeServiceResult(
            service,
            now,
            coordinates,
            availabilitySnapshots.get(service.id) ?? null,
          ),
        )
        .filter((service) =>
          this.isWithinRadius(service.distanceKm, query.radiusKm),
        ),
      {
        sortMode,
        coordinates,
        defaultPrioritizeAvailability: Boolean(requestedAvailability),
        relevanceScores: serviceSearchResult.relevanceScores,
        popularityScores,
      },
    ).filter(
      (service) =>
        !query.availableOnly || service.availability?.isAvailable === true,
    );

    return this.paginateDiscoveryItems(items, limit, cursorOffset);
  }

  private async buildServiceAvailabilitySnapshots(
    services: ServiceSearchRecord[],
    requestedAvailability: RequestedAvailabilityWindow | null,
  ): Promise<Map<string, ServiceAvailabilitySnapshot>> {
    if (!requestedAvailability || services.length === 0) {
      return new Map();
    }

    const conflictingSoloServiceIds = await this.findConflictingSoloServiceIds(
      services
        .filter((service) => service.serviceType === ServiceType.SOLO)
        .map((service) => service.id),
      requestedAvailability,
    );

    return new Map(
      services.map((service) => [
        service.id,
        this.evaluateServiceAvailability(
          service,
          requestedAvailability,
          conflictingSoloServiceIds,
        ),
      ]),
    );
  }

  private async findConflictingSoloServiceIds(
    serviceIds: string[],
    requestedAvailability: RequestedAvailabilityWindow,
  ): Promise<Set<string>> {
    if (serviceIds.length === 0) {
      return new Set();
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        serviceId: {
          in: serviceIds,
        },
        status: ReservationStatus.CONFIRMED,
      },
      select: {
        serviceId: true,
        requestedStartAt: true,
        requestedEndAt: true,
      },
    });

    return new Set(
      reservations
        .filter((reservation) =>
          doReservationWindowsConflict(
            requestedAvailability.requestedStartAt,
            requestedAvailability.requestedEndAt,
            reservation.requestedStartAt,
            reservation.requestedEndAt,
          ),
        )
        .map((reservation) => reservation.serviceId),
    );
  }

  private evaluateServiceAvailability(
    service: ServiceSearchRecord,
    requestedAvailability: RequestedAvailabilityWindow,
    conflictingSoloServiceIds: ReadonlySet<string>,
  ): ServiceAvailabilitySnapshot {
    const { requestedStartAt, requestedEndAt } = requestedAvailability;

    const overlappingManualBlock = service.manualBlocks.find((manualBlock) =>
      doReservationWindowsConflict(
        requestedStartAt,
        requestedEndAt,
        manualBlock.startsAt,
        manualBlock.endsAt,
      ),
    );

    if (overlappingManualBlock) {
      return this.buildAvailabilitySnapshot(
        requestedAvailability,
        false,
        'MANUAL_BLOCK',
      );
    }

    const startTime = formatUtcTime(requestedStartAt);
    const endTime = requestedEndAt ? formatUtcTime(requestedEndAt) : null;
    const matchingException = service.availabilityExceptions.find((exception) =>
      isSameUtcDate(exception.date, requestedStartAt),
    );

    if (matchingException) {
      if (matchingException.isClosedAllDay) {
        return this.buildAvailabilitySnapshot(
          requestedAvailability,
          false,
          'EXCEPTION_CLOSED',
        );
      }

      if (
        !matchingException.startTime ||
        !matchingException.endTime ||
        !isReservationWindowInsideTimeRange(
          startTime,
          endTime,
          matchingException.startTime,
          matchingException.endTime,
        )
      ) {
        return this.buildAvailabilitySnapshot(
          requestedAvailability,
          false,
          'OUTSIDE_EXCEPTION_HOURS',
        );
      }

      return this.buildAvailabilitySnapshot(requestedAvailability, true, null);
    }

    const matchingRules = service.availabilityRules.filter(
      (rule) => rule.dayOfWeek === getDayOfWeekFromUtc(requestedStartAt),
    );

    if (matchingRules.length === 0) {
      return this.buildAvailabilitySnapshot(
        requestedAvailability,
        false,
        'DAY_UNAVAILABLE',
      );
    }

    const isInsideAnyRule = matchingRules.some((rule) =>
      isReservationWindowInsideTimeRange(
        startTime,
        endTime,
        rule.startTime,
        rule.endTime,
      ),
    );

    if (!isInsideAnyRule) {
      return this.buildAvailabilitySnapshot(
        requestedAvailability,
        false,
        'OUTSIDE_RULE_HOURS',
      );
    }

    if (conflictingSoloServiceIds.has(service.id)) {
      return this.buildAvailabilitySnapshot(
        requestedAvailability,
        false,
        'SOLO_CONFLICT',
      );
    }

    return this.buildAvailabilitySnapshot(requestedAvailability, true, null);
  }

  private buildAvailabilitySnapshot(
    requestedAvailability: RequestedAvailabilityWindow,
    isAvailable: boolean,
    reasonCode: ServiceAvailabilityReasonCode | null,
  ): ServiceAvailabilitySnapshot {
    return {
      isAvailable,
      reasonCode,
      reason: reasonCode ? this.getAvailabilityReasonMessage(reasonCode) : null,
      requestedStartAt: requestedAvailability.requestedStartAt,
      requestedEndAt: requestedAvailability.requestedEndAt,
    };
  }

  private getAvailabilityReasonMessage(
    reasonCode: ServiceAvailabilityReasonCode,
  ): string {
    switch (reasonCode) {
      case 'MANUAL_BLOCK':
        return 'The requested time falls inside a manual service block.';
      case 'EXCEPTION_CLOSED':
        return 'The service is closed on the requested date.';
      case 'OUTSIDE_EXCEPTION_HOURS':
        return 'The requested time falls outside the exception availability window.';
      case 'DAY_UNAVAILABLE':
        return 'The service is not available on the requested day.';
      case 'OUTSIDE_RULE_HOURS':
        return 'The requested time falls outside the regular availability window.';
      case 'SOLO_CONFLICT':
        return 'The requested time is already reserved for this solo service.';
      default:
        return 'The requested time is not available.';
    }
  }

  private resolveRequestedAvailability(
    query: SearchDiscoveryDto,
  ): RequestedAvailabilityWindow | null {
    const requestedStartInput = query.requestedStartAt;
    const requestedEndInput = query.requestedEndAt;

    if (requestedStartInput === undefined && requestedEndInput === undefined) {
      if (query.availableOnly) {
        throw new BadRequestException(
          'requestedStartAt is required when availableOnly is true.',
        );
      }

      return null;
    }

    if (requestedStartInput === undefined) {
      throw new BadRequestException(
        'requestedStartAt is required when requestedEndAt is provided.',
      );
    }

    const requestedStartAt = this.parseDateInput(
      requestedStartInput,
      'requestedStartAt',
    );
    const requestedEndAt = requestedEndInput
      ? this.parseDateInput(requestedEndInput, 'requestedEndAt')
      : null;

    if (
      requestedEndAt &&
      requestedEndAt.getTime() <= requestedStartAt.getTime()
    ) {
      throw new BadRequestException(
        'requestedEndAt must be later than requestedStartAt.',
      );
    }

    if (requestedEndAt && !isSameUtcDate(requestedStartAt, requestedEndAt)) {
      throw new BadRequestException(
        'Availability discovery windows must fall on the same UTC day.',
      );
    }

    return {
      requestedStartAt,
      requestedEndAt,
    };
  }

  private parseDateInput(
    value: Date | string,
    fieldName: 'requestedStartAt' | 'requestedEndAt',
  ): Date {
    const parsedValue =
      value instanceof Date ? new Date(value.getTime()) : new Date(value);

    if (Number.isNaN(parsedValue.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date.`);
    }

    return parsedValue;
  }

  private resolveSortMode(
    query: SearchDiscoveryDto,
    entityKind: DiscoveryEntityKind,
  ): SearchSortMode {
    const requestedSortMode = query.sortBy ?? SearchSortMode.RELEVANCE;

    if (
      entityKind !== 'service' &&
      [
        SearchSortMode.PRICE_LOW,
        SearchSortMode.PRICE_HIGH,
        SearchSortMode.AVAILABILITY,
      ].includes(requestedSortMode)
    ) {
      return SearchSortMode.RELEVANCE;
    }

    return requestedSortMode;
  }

  private assertSortRequirements(
    sortMode: SearchSortMode,
    coordinates: { lat: number; lng: number } | null,
    requestedAvailability: RequestedAvailabilityWindow | null,
  ): void {
    if (sortMode === SearchSortMode.PROXIMITY && !coordinates) {
      throw new BadRequestException(
        'lat and lng are required when sortBy=PROXIMITY.',
      );
    }

    if (sortMode === SearchSortMode.AVAILABILITY && !requestedAvailability) {
      throw new BadRequestException(
        'requestedStartAt is required when sortBy=AVAILABILITY.',
      );
    }
  }

  private async getDiscoveryBrands(
    query: SearchDiscoveryDto,
    coordinates: { lat: number; lng: number } | null,
  ): Promise<DiscoveryPage<DiscoveryItem>> {
    const now = new Date();
    const limit = query.limit ?? 10;
    const cursorOffset = this.resolveCursorOffset(query.cursor);
    const sortMode = this.resolveSortMode(query, 'brand');
    const geoBounds = this.resolveGeoBounds(query, coordinates);
    this.assertSortRequirements(sortMode, coordinates, null);
    const brandSearchResult = await this.searchBrands(
      query,
      this.resolveFetchTake(limit, cursorOffset, 3),
      geoBounds,
    );
    const brands = brandSearchResult.records;
    const popularityScores =
      sortMode === SearchSortMode.POPULARITY
        ? new Map(
            brands.map((brand) => [
              brand.id,
              brand.brandPopularityStat?.popularityScore ?? 0,
            ]),
          )
        : null;

    const items = this.sortDiscoveryItems(
      brands
        .map((brand) => this.serializeBrandResult(brand, now, coordinates))
        .filter((brand) =>
          this.isWithinRadius(brand.distanceKm, query.radiusKm),
        ),
      {
        sortMode,
        coordinates,
        defaultPrioritizeAvailability: false,
        relevanceScores: brandSearchResult.relevanceScores,
        popularityScores,
      },
    );

    return this.paginateDiscoveryItems(items, limit, cursorOffset);
  }

  private async getDiscoveryProviders(
    query: SearchDiscoveryDto,
    coordinates: { lat: number; lng: number } | null,
  ): Promise<DiscoveryPage<DiscoveryItem>> {
    const now = new Date();
    const limit = query.limit ?? 10;
    const cursorOffset = this.resolveCursorOffset(query.cursor);
    const sortMode = this.resolveSortMode(query, 'provider');
    const geoBounds = this.resolveGeoBounds(query, coordinates);
    this.assertSortRequirements(sortMode, coordinates, null);
    const providerSearchResult = await this.searchProviders(
      query,
      this.resolveFetchTake(limit, cursorOffset, 3),
      geoBounds,
    );
    const providers = providerSearchResult.records;
    const popularityScores =
      sortMode === SearchSortMode.POPULARITY
        ? new Map(
            providers.map((provider) => [
              provider.id,
              provider.serviceOwnerPopularityStat?.popularityScore ?? 0,
            ]),
          )
        : null;

    const items = this.sortDiscoveryItems(
      providers
        .map((provider) =>
          this.serializeProviderResult(provider, now, coordinates),
        )
        .filter((provider) =>
          this.isWithinRadius(provider.distanceKm, query.radiusKm),
        ),
      {
        sortMode,
        coordinates,
        defaultPrioritizeAvailability: false,
        relevanceScores: providerSearchResult.relevanceScores,
        popularityScores,
      },
    );

    return this.paginateDiscoveryItems(items, limit, cursorOffset);
  }

  private async searchServices(
    query: SearchDiscoveryDto,
    take: number,
    geoBounds: GeoBounds | null,
  ): Promise<SearchResultPage<ServiceSearchRecord>> {
    const normalizedQuery = this.normalizeSearchQuery(query.q);
    const activeVisibilityWhere = this.buildServiceActiveVisibilityWhere(query);

    if (normalizedQuery) {
      const hits = await this.findRankedServiceHits(
        query,
        take,
        normalizedQuery,
        geoBounds,
      );

      if (hits.length === 0) {
        return {
          records: [],
          relevanceScores: new Map<string, number>(),
        };
      }

      const services = await this.prisma.service.findMany({
        where: {
          id: {
            in: hits.map((hit) => hit.id),
          },
        },
        include: serviceSearchInclude,
      });

      return {
        records: this.orderRecordsByHits(services, hits),
        relevanceScores: this.buildRelevanceScoreMap(hits),
      };
    }

    return {
      records: await this.prisma.service.findMany({
        where: {
          isActive: true,
          ownerUser: {
            is: {
              status: UserStatus.ACTIVE,
            },
          },
          ...(query.brandId ? { brandId: query.brandId } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
          ...(query.serviceType ? { serviceType: query.serviceType } : {}),
          ...(query.approvalMode ? { approvalMode: query.approvalMode } : {}),
          ...(query.minPriceAmount !== undefined
            ? {
                priceAmount: {
                  gte: query.minPriceAmount,
                },
              }
            : {}),
          ...(query.maxPriceAmount !== undefined
            ? {
                priceAmount: {
                  ...(query.minPriceAmount !== undefined
                    ? { gte: query.minPriceAmount }
                    : {}),
                  lte: query.maxPriceAmount,
                },
              }
            : {}),
          ...(query.city || query.country
            ? {
                address: {
                  is: {
                    ...(query.city
                      ? {
                          city: {
                            equals: query.city,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                    ...(query.country
                      ? {
                          country: {
                            equals: query.country,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
          ...(geoBounds
            ? {
                address: {
                  is: {
                    lat: {
                      gte: geoBounds.minLat,
                      lte: geoBounds.maxLat,
                    },
                    lng: {
                      gte: geoBounds.minLng,
                      lte: geoBounds.maxLng,
                    },
                  },
                },
              }
            : {}),
          ...activeVisibilityWhere,
        },
        include: serviceSearchInclude,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      relevanceScores: null,
    };
  }

  private async searchBrands(
    query: SearchDiscoveryDto,
    take: number,
    geoBounds: GeoBounds | null,
  ): Promise<SearchResultPage<BrandSearchRecord>> {
    const normalizedQuery = this.normalizeSearchQuery(query.q);

    if (normalizedQuery) {
      const hits = await this.findRankedBrandHits(
        query,
        take,
        normalizedQuery,
        geoBounds,
      );

      if (hits.length === 0) {
        return {
          records: [],
          relevanceScores: new Map<string, number>(),
        };
      }

      const brands = await this.prisma.brand.findMany({
        where: {
          id: {
            in: hits.map((hit) => hit.id),
          },
        },
        include: brandSearchInclude,
      });

      return {
        records: this.orderRecordsByHits(brands, hits),
        relevanceScores: this.buildRelevanceScoreMap(hits),
      };
    }

    return {
      records: await this.prisma.brand.findMany({
        where: {
          status: BrandStatus.ACTIVE,
          ...(query.brandId ? { id: query.brandId } : {}),
          ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
          ...(query.city || query.country
            ? {
                addresses: {
                  some: {
                    isPrimary: true,
                    ...(query.city
                      ? {
                          city: {
                            equals: query.city,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                    ...(query.country
                      ? {
                          country: {
                            equals: query.country,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
          ...(geoBounds
            ? {
                addresses: {
                  some: {
                    isPrimary: true,
                    lat: {
                      gte: geoBounds.minLat,
                      lte: geoBounds.maxLat,
                    },
                    lng: {
                      gte: geoBounds.minLng,
                      lte: geoBounds.maxLng,
                    },
                  },
                },
              }
            : {}),
          ...(query.visibilityLabelSlug
            ? {
                visibilityAssignments: {
                  some: {
                    label: {
                      slug: query.visibilityLabelSlug.trim().toLowerCase(),
                      isActive: true,
                    },
                    startsAt: {
                      lte: new Date(),
                    },
                    OR: [
                      {
                        endsAt: null,
                      },
                      {
                        endsAt: {
                          gt: new Date(),
                        },
                      },
                    ],
                  },
                },
              }
            : {}),
        },
        include: brandSearchInclude,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      relevanceScores: null,
    };
  }

  private async searchProviders(
    query: SearchDiscoveryDto,
    take: number,
    geoBounds: GeoBounds | null,
  ): Promise<SearchResultPage<ProviderSearchRecord>> {
    const normalizedQuery = this.normalizeSearchQuery(query.q);

    if (normalizedQuery) {
      const hits = await this.findRankedProviderHits(
        query,
        take,
        normalizedQuery,
        geoBounds,
      );

      if (hits.length === 0) {
        return {
          records: [],
          relevanceScores: new Map<string, number>(),
        };
      }

      const providers = await this.prisma.user.findMany({
        where: {
          id: {
            in: hits.map((hit) => hit.id),
          },
        },
        include: providerSearchInclude,
      });

      return {
        records: this.orderRecordsByHits(providers, hits),
        relevanceScores: this.buildRelevanceScoreMap(hits),
      };
    }

    return {
      records: await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          roles: {
            some: {
              role: AppRole.USO,
            },
          },
          ...(query.ownerUserId ? { id: query.ownerUserId } : {}),
          ...(query.brandId
            ? {
                OR: [
                  {
                    ownedBrands: {
                      some: {
                        id: query.brandId,
                      },
                    },
                  },
                  {
                    services: {
                      some: {
                        brandId: query.brandId,
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(query.categoryId
            ? {
                services: {
                  some: {
                    isActive: true,
                    categoryId: query.categoryId,
                  },
                },
              }
            : {}),
          ...(query.serviceType
            ? {
                services: {
                  some: {
                    isActive: true,
                    serviceType: query.serviceType,
                  },
                },
              }
            : {}),
          ...(query.approvalMode
            ? {
                services: {
                  some: {
                    isActive: true,
                    approvalMode: query.approvalMode,
                  },
                },
              }
            : {}),
          ...(query.city || query.country
            ? {
                OR: [
                  {
                    services: {
                      some: {
                        isActive: true,
                        address: {
                          is: {
                            ...(query.city
                              ? {
                                  city: {
                                    equals: query.city,
                                    mode: 'insensitive',
                                  },
                                }
                              : {}),
                            ...(query.country
                              ? {
                                  country: {
                                    equals: query.country,
                                    mode: 'insensitive',
                                  },
                                }
                              : {}),
                          },
                        },
                      },
                    },
                  },
                  {
                    ownedBrands: {
                      some: {
                        addresses: {
                          some: {
                            isPrimary: true,
                            ...(query.city
                              ? {
                                  city: {
                                    equals: query.city,
                                    mode: 'insensitive',
                                  },
                                }
                              : {}),
                            ...(query.country
                              ? {
                                  country: {
                                    equals: query.country,
                                    mode: 'insensitive',
                                  },
                                }
                              : {}),
                          },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(geoBounds
            ? {
                OR: [
                  {
                    services: {
                      some: {
                        isActive: true,
                        address: {
                          is: {
                            lat: {
                              gte: geoBounds.minLat,
                              lte: geoBounds.maxLat,
                            },
                            lng: {
                              gte: geoBounds.minLng,
                              lte: geoBounds.maxLng,
                            },
                          },
                        },
                      },
                    },
                  },
                  {
                    ownedBrands: {
                      some: {
                        addresses: {
                          some: {
                            isPrimary: true,
                            lat: {
                              gte: geoBounds.minLat,
                              lte: geoBounds.maxLat,
                            },
                            lng: {
                              gte: geoBounds.minLng,
                              lte: geoBounds.maxLng,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(query.visibilityLabelSlug
            ? {
                visibilityAssignments: {
                  some: {
                    label: {
                      slug: query.visibilityLabelSlug.trim().toLowerCase(),
                      isActive: true,
                    },
                    startsAt: {
                      lte: new Date(),
                    },
                    OR: [
                      {
                        endsAt: null,
                      },
                      {
                        endsAt: {
                          gt: new Date(),
                        },
                      },
                    ],
                  },
                },
              }
            : {}),
        },
        include: providerSearchInclude,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      relevanceScores: null,
    };
  }

  private async findRankedServiceHits(
    query: SearchDiscoveryDto,
    take: number,
    normalizedQuery: string,
    geoBounds: GeoBounds | null,
  ): Promise<RankedSearchHit[]> {
    const now = new Date();
    const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${normalizedQuery})`;
    const documentVector = Prisma.sql`to_tsvector('simple', coalesce(ssd.search_text, ''))`;
    const relevanceScore = Prisma.sql`
      (
        CASE
          WHEN lower(coalesce(ssd.service_name, '')) = lower(${normalizedQuery}) THEN 50
          WHEN lower(coalesce(ssd.service_name, '')) LIKE lower(${normalizedQuery}) || '%' THEN 20
          ELSE 0
        END +
        (ts_rank_cd(${documentVector}, ${tsQuery}) * 10) +
        greatest(
          similarity(lower(coalesce(ssd.service_name, '')), lower(${normalizedQuery})) * 8,
          similarity(lower(coalesce(ssd.brand_name, '')), lower(${normalizedQuery})) * 6,
          similarity(lower(coalesce(ssd.owner_full_name, '')), lower(${normalizedQuery})) * 5,
          similarity(lower(coalesce(ssd.category_name, '')), lower(${normalizedQuery})) * 4,
          similarity(lower(coalesce(ssd.city, '')), lower(${normalizedQuery})) * 2,
          similarity(lower(coalesce(ssd.country, '')), lower(${normalizedQuery})) * 2
        )
      )
    `;
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`s.is_active = true`,
      Prisma.sql`u.status::text = ${UserStatus.ACTIVE}`,
      Prisma.sql`
        (
          ${documentVector} @@ ${tsQuery}
          OR similarity(lower(coalesce(ssd.service_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(ssd.brand_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(ssd.owner_full_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(ssd.category_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(ssd.city, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(ssd.country, '')), lower(${normalizedQuery})) >= 0.1
        )
      `,
    ];

    if (query.brandId) {
      whereConditions.push(Prisma.sql`s.brand_id = ${query.brandId}::uuid`);
    }

    if (query.categoryId) {
      whereConditions.push(
        Prisma.sql`s.category_id = ${query.categoryId}::uuid`,
      );
    }

    if (query.ownerUserId) {
      whereConditions.push(
        Prisma.sql`s.owner_user_id = ${query.ownerUserId}::uuid`,
      );
    }

    if (query.serviceType) {
      whereConditions.push(
        Prisma.sql`s.service_type::text = ${query.serviceType}`,
      );
    }

    if (query.approvalMode) {
      whereConditions.push(
        Prisma.sql`s.approval_mode::text = ${query.approvalMode}`,
      );
    }

    if (query.minPriceAmount !== undefined) {
      whereConditions.push(
        Prisma.sql`s.price_amount >= ${new Prisma.Decimal(query.minPriceAmount)}`,
      );
    }

    if (query.maxPriceAmount !== undefined) {
      whereConditions.push(
        Prisma.sql`s.price_amount <= ${new Prisma.Decimal(query.maxPriceAmount)}`,
      );
    }

    if (query.city) {
      whereConditions.push(
        Prisma.sql`lower(coalesce(ssd.city, '')) = lower(${query.city})`,
      );
    }

    if (query.country) {
      whereConditions.push(
        Prisma.sql`lower(coalesce(ssd.country, '')) = lower(${query.country})`,
      );
    }

    if (geoBounds) {
      whereConditions.push(
        Prisma.sql`
          sa.lat between ${geoBounds.minLat} and ${geoBounds.maxLat}
          and sa.lng between ${geoBounds.minLng} and ${geoBounds.maxLng}
        `,
      );
    }

    if (query.visibilityLabelSlug) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from service_visibility_assignments sva
            join visibility_labels vl on vl.id = sva.label_id
            where sva.service_id = s.id
              and vl.slug = ${query.visibilityLabelSlug.trim().toLowerCase()}
              and vl.is_active = true
              and sva.starts_at <= ${now}
              and (sva.ends_at is null or sva.ends_at > ${now})
          )
        `,
      );
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; relevance_score: number }>
    >(Prisma.sql`
      select
        s.id,
        ${relevanceScore} as relevance_score
      from services s
      join service_search_documents ssd on ssd.service_id = s.id
      left join service_addresses sa on sa.id = s.address_id
      join users u on u.id = s.owner_user_id
      where ${Prisma.join(whereConditions, ' and ')}
      order by relevance_score desc, s.created_at desc
      limit ${take}
    `);

    return rows.map((row) => ({
      id: row.id,
      relevanceScore: Number(row.relevance_score),
    }));
  }

  private async findRankedBrandHits(
    query: SearchDiscoveryDto,
    take: number,
    normalizedQuery: string,
    geoBounds: GeoBounds | null,
  ): Promise<RankedSearchHit[]> {
    const now = new Date();
    const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${normalizedQuery})`;
    const documentVector = Prisma.sql`to_tsvector('simple', coalesce(bsd.search_text, ''))`;
    const relevanceScore = Prisma.sql`
      (
        CASE
          WHEN lower(coalesce(bsd.brand_name, '')) = lower(${normalizedQuery}) THEN 50
          WHEN lower(coalesce(bsd.brand_name, '')) LIKE lower(${normalizedQuery}) || '%' THEN 20
          ELSE 0
        END +
        (ts_rank_cd(${documentVector}, ${tsQuery}) * 10) +
        greatest(
          similarity(lower(coalesce(bsd.brand_name, '')), lower(${normalizedQuery})) * 8,
          similarity(lower(coalesce(bsd.owner_full_name, '')), lower(${normalizedQuery})) * 5,
          similarity(lower(coalesce(bsd.city, '')), lower(${normalizedQuery})) * 2,
          similarity(lower(coalesce(bsd.country, '')), lower(${normalizedQuery})) * 2
        )
      )
    `;
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`b.status::text = ${BrandStatus.ACTIVE}`,
      Prisma.sql`
        (
          ${documentVector} @@ ${tsQuery}
          OR similarity(lower(coalesce(bsd.brand_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(bsd.owner_full_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(bsd.city, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(bsd.country, '')), lower(${normalizedQuery})) >= 0.1
        )
      `,
    ];

    if (query.brandId) {
      whereConditions.push(Prisma.sql`b.id = ${query.brandId}::uuid`);
    }

    if (query.ownerUserId) {
      whereConditions.push(
        Prisma.sql`b.owner_user_id = ${query.ownerUserId}::uuid`,
      );
    }

    if (query.city) {
      whereConditions.push(
        Prisma.sql`lower(coalesce(bsd.city, '')) = lower(${query.city})`,
      );
    }

    if (query.country) {
      whereConditions.push(
        Prisma.sql`lower(coalesce(bsd.country, '')) = lower(${query.country})`,
      );
    }

    if (geoBounds) {
      whereConditions.push(
        Prisma.sql`
          ba.lat between ${geoBounds.minLat} and ${geoBounds.maxLat}
          and ba.lng between ${geoBounds.minLng} and ${geoBounds.maxLng}
        `,
      );
    }

    if (query.visibilityLabelSlug) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from brand_visibility_assignments bva
            join visibility_labels vl on vl.id = bva.label_id
            where bva.brand_id = b.id
              and vl.slug = ${query.visibilityLabelSlug.trim().toLowerCase()}
              and vl.is_active = true
              and bva.starts_at <= ${now}
              and (bva.ends_at is null or bva.ends_at > ${now})
          )
        `,
      );
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; relevance_score: number }>
    >(Prisma.sql`
      select
        b.id,
        ${relevanceScore} as relevance_score
      from brands b
      join brand_search_documents bsd on bsd.brand_id = b.id
      left join brand_addresses ba
        on ba.brand_id = b.id
       and ba.is_primary = true
      where ${Prisma.join(whereConditions, ' and ')}
      order by relevance_score desc, b.created_at desc
      limit ${take}
    `);

    return rows.map((row) => ({
      id: row.id,
      relevanceScore: Number(row.relevance_score),
    }));
  }

  private async findRankedProviderHits(
    query: SearchDiscoveryDto,
    take: number,
    normalizedQuery: string,
    geoBounds: GeoBounds | null,
  ): Promise<RankedSearchHit[]> {
    const now = new Date();
    const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${normalizedQuery})`;
    const documentVector = Prisma.sql`to_tsvector('simple', coalesce(psd.search_text, ''))`;
    const relevanceScore = Prisma.sql`
      (
        CASE
          WHEN lower(coalesce(psd.full_name, '')) = lower(${normalizedQuery}) THEN 50
          WHEN lower(coalesce(psd.full_name, '')) LIKE lower(${normalizedQuery}) || '%' THEN 20
          ELSE 0
        END +
        (ts_rank_cd(${documentVector}, ${tsQuery}) * 10) +
        greatest(
          similarity(lower(coalesce(psd.full_name, '')), lower(${normalizedQuery})) * 8,
          similarity(lower(coalesce(psd.service_names, '')), lower(${normalizedQuery})) * 5,
          similarity(lower(coalesce(psd.brand_names, '')), lower(${normalizedQuery})) * 5,
          similarity(lower(coalesce(psd.city_names, '')), lower(${normalizedQuery})) * 2,
          similarity(lower(coalesce(psd.country_names, '')), lower(${normalizedQuery})) * 2
        )
      )
    `;
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`u.status::text = ${UserStatus.ACTIVE}`,
      Prisma.sql`
        exists (
          select 1
          from user_roles ur
          where ur.user_id = u.id
            and ur.role::text = ${AppRole.USO}
        )
      `,
      Prisma.sql`
        (
          ${documentVector} @@ ${tsQuery}
          OR similarity(lower(coalesce(psd.full_name, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(psd.service_names, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(psd.brand_names, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(psd.city_names, '')), lower(${normalizedQuery})) >= 0.1
          OR similarity(lower(coalesce(psd.country_names, '')), lower(${normalizedQuery})) >= 0.1
        )
      `,
    ];

    if (query.ownerUserId) {
      whereConditions.push(Prisma.sql`u.id = ${query.ownerUserId}::uuid`);
    }

    if (query.brandId) {
      whereConditions.push(
        Prisma.sql`
          (
            exists (
              select 1
              from brands b_filter
              where b_filter.owner_user_id = u.id
                and b_filter.id = ${query.brandId}::uuid
            )
            or exists (
              select 1
              from services s_filter
              where s_filter.owner_user_id = u.id
                and s_filter.brand_id = ${query.brandId}::uuid
            )
          )
        `,
      );
    }

    if (query.categoryId) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from services s_filter
            where s_filter.owner_user_id = u.id
              and s_filter.is_active = true
              and s_filter.category_id = ${query.categoryId}::uuid
          )
        `,
      );
    }

    if (query.serviceType) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from services s_filter
            where s_filter.owner_user_id = u.id
              and s_filter.is_active = true
              and s_filter.service_type::text = ${query.serviceType}
          )
        `,
      );
    }

    if (query.approvalMode) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from services s_filter
            where s_filter.owner_user_id = u.id
              and s_filter.is_active = true
              and s_filter.approval_mode::text = ${query.approvalMode}
          )
        `,
      );
    }

    if (query.city || query.country) {
      const serviceLocationConditions: Prisma.Sql[] = [
        Prisma.sql`s_filter.is_active = true`,
      ];
      const brandLocationConditions: Prisma.Sql[] = [
        Prisma.sql`ba_filter.is_primary = true`,
      ];

      if (query.city) {
        serviceLocationConditions.push(
          Prisma.sql`lower(coalesce(sa_filter.city, '')) = lower(${query.city})`,
        );
        brandLocationConditions.push(
          Prisma.sql`lower(coalesce(ba_filter.city, '')) = lower(${query.city})`,
        );
      }

      if (query.country) {
        serviceLocationConditions.push(
          Prisma.sql`lower(coalesce(sa_filter.country, '')) = lower(${query.country})`,
        );
        brandLocationConditions.push(
          Prisma.sql`lower(coalesce(ba_filter.country, '')) = lower(${query.country})`,
        );
      }

      whereConditions.push(
        Prisma.sql`
          (
            exists (
              select 1
              from services s_filter
              join service_addresses sa_filter
                on sa_filter.id = s_filter.address_id
              where s_filter.owner_user_id = u.id
                and ${Prisma.join(serviceLocationConditions, ' and ')}
            )
            or exists (
              select 1
              from brands b_filter
              join brand_addresses ba_filter
                on ba_filter.brand_id = b_filter.id
              where b_filter.owner_user_id = u.id
                and b_filter.status::text = ${BrandStatus.ACTIVE}
                and ${Prisma.join(brandLocationConditions, ' and ')}
            )
          )
        `,
      );
    }

    if (geoBounds) {
      whereConditions.push(
        Prisma.sql`
          (
            exists (
              select 1
              from services s_geo
              join service_addresses sa_geo
                on sa_geo.id = s_geo.address_id
              where s_geo.owner_user_id = u.id
                and s_geo.is_active = true
                and sa_geo.lat between ${geoBounds.minLat} and ${geoBounds.maxLat}
                and sa_geo.lng between ${geoBounds.minLng} and ${geoBounds.maxLng}
            )
            or exists (
              select 1
              from brands b_geo
              join brand_addresses ba_geo
                on ba_geo.brand_id = b_geo.id
              where b_geo.owner_user_id = u.id
                and b_geo.status::text = ${BrandStatus.ACTIVE}
                and ba_geo.is_primary = true
                and ba_geo.lat between ${geoBounds.minLat} and ${geoBounds.maxLat}
                and ba_geo.lng between ${geoBounds.minLng} and ${geoBounds.maxLng}
            )
          )
        `,
      );
    }

    if (query.visibilityLabelSlug) {
      whereConditions.push(
        Prisma.sql`
          exists (
            select 1
            from user_visibility_assignments uva
            join visibility_labels vl on vl.id = uva.label_id
            where uva.user_id = u.id
              and vl.slug = ${query.visibilityLabelSlug.trim().toLowerCase()}
              and vl.is_active = true
              and uva.starts_at <= ${now}
              and (uva.ends_at is null or uva.ends_at > ${now})
          )
        `,
      );
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; relevance_score: number }>
    >(Prisma.sql`
      select
        u.id,
        ${relevanceScore} as relevance_score
      from users u
      join provider_search_documents psd on psd.user_id = u.id
      where ${Prisma.join(whereConditions, ' and ')}
      order by relevance_score desc, u.created_at desc
      limit ${take}
    `);

    return rows.map((row) => ({
      id: row.id,
      relevanceScore: Number(row.relevance_score),
    }));
  }

  private buildServiceActiveVisibilityWhere(
    query: SearchDiscoveryDto,
  ): Prisma.ServiceWhereInput {
    return query.visibilityLabelSlug
      ? {
          visibilityAssignments: {
            some: {
              label: {
                slug: query.visibilityLabelSlug.trim().toLowerCase(),
                isActive: true,
              },
              startsAt: {
                lte: new Date(),
              },
              OR: [
                {
                  endsAt: null,
                },
                {
                  endsAt: {
                    gt: new Date(),
                  },
                },
              ],
            },
          },
        }
      : {};
  }

  private serializeServiceResult(
    service: ServiceSearchRecord,
    now: Date,
    coordinates: { lat: number; lng: number } | null,
    availability: ServiceAvailabilitySnapshot | null,
  ): DiscoveryItem {
    const distanceKm = this.calculateAddressDistance(
      service.address,
      coordinates,
    );

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      address: service.address,
      distanceKm,
      ratingStats: service.ratingStat ?? {
        avgRating: 0,
        reviewCount: 0,
      },
      visibilityLabels: serializeActiveVisibilityLabels(
        service.visibilityAssignments,
        now,
      ),
      visibilityPriority: getMaxActiveVisibilityPriority(
        service.visibilityAssignments,
        now,
      ),
      owner: {
        id: service.ownerUser.id,
        fullName: service.ownerUser.fullName,
        ratingStats: service.ownerUser.serviceOwnerRatingStat ?? {
          avgRating: 0,
          reviewCount: 0,
        },
        visibilityLabels: serializeActiveVisibilityLabels(
          service.ownerUser.visibilityAssignments,
          now,
        ),
      },
      brand: service.brand
        ? {
            id: service.brand.id,
            name: service.brand.name,
            status: service.brand.status,
            ratingStats: service.brand.brandRatingStat ?? {
              avgRating: 0,
              reviewCount: 0,
            },
            visibilityLabels: serializeActiveVisibilityLabels(
              service.brand.visibilityAssignments,
              now,
            ),
          }
        : null,
      serviceType: service.serviceType,
      approvalMode: service.approvalMode,
      priceAmount: service.priceAmount,
      priceCurrency: service.priceCurrency,
      availability: availability ?? undefined,
      createdAt: service.createdAt,
    };
  }

  private serializeBrandResult(
    brand: BrandSearchRecord,
    now: Date,
    coordinates: { lat: number; lng: number } | null,
  ): DiscoveryItem {
    const primaryAddress = brand.addresses[0] ?? null;
    const distanceKm = this.calculateAddressDistance(
      primaryAddress,
      coordinates,
    );

    return {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      address: primaryAddress,
      distanceKm,
      ratingStats: brand.brandRatingStat ?? {
        avgRating: 0,
        reviewCount: 0,
      },
      visibilityLabels: serializeActiveVisibilityLabels(
        brand.visibilityAssignments,
        now,
      ),
      visibilityPriority: getMaxActiveVisibilityPriority(
        brand.visibilityAssignments,
        now,
      ),
      owner: {
        id: brand.owner.id,
        fullName: brand.owner.fullName,
        ratingStats: brand.owner.serviceOwnerRatingStat ?? {
          avgRating: 0,
          reviewCount: 0,
        },
        visibilityLabels: serializeActiveVisibilityLabels(
          brand.owner.visibilityAssignments,
          now,
        ),
      },
      createdAt: brand.createdAt,
    };
  }

  private serializeProviderResult(
    provider: ProviderSearchRecord,
    now: Date,
    coordinates: { lat: number; lng: number } | null,
  ): DiscoveryItem {
    const candidateDistances = provider.services
      .map((service) =>
        this.calculateAddressDistance(service.address, coordinates),
      )
      .concat(
        provider.ownedBrands.map((brand) =>
          this.calculateAddressDistance(
            brand.addresses[0] ?? null,
            coordinates,
          ),
        ),
      )
      .filter((value): value is number => value !== null);
    const distanceKm =
      candidateDistances.length > 0 ? Math.min(...candidateDistances) : null;

    return {
      id: provider.id,
      name: provider.fullName,
      distanceKm,
      ratingStats: provider.serviceOwnerRatingStat ?? {
        avgRating: 0,
        reviewCount: 0,
      },
      visibilityLabels: serializeActiveVisibilityLabels(
        provider.visibilityAssignments,
        now,
      ),
      visibilityPriority: getMaxActiveVisibilityPriority(
        provider.visibilityAssignments,
        now,
      ),
      featuredServices: provider.services.map((service) => ({
        id: service.id,
        name: service.name,
        serviceType: service.serviceType,
        approvalMode: service.approvalMode,
        brand: service.brand,
        address: service.address,
      })),
      brands: provider.ownedBrands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        primaryAddress: brand.addresses[0] ?? null,
      })),
      createdAt: provider.createdAt,
    };
  }

  private sortDiscoveryItems<T extends DiscoveryItem>(
    items: T[],
    options: {
      sortMode: SearchSortMode;
      coordinates: { lat: number; lng: number } | null;
      defaultPrioritizeAvailability: boolean;
      relevanceScores?: RelevanceScoreMap | null;
      popularityScores?: PopularityScoreMap | null;
    },
  ): T[] {
    return [...items].sort((left, right) => {
      const comparators = this.getComparatorsForSortMode(options.sortMode, {
        coordinates: options.coordinates,
        defaultPrioritizeAvailability: options.defaultPrioritizeAvailability,
        relevanceScores: options.relevanceScores ?? null,
        popularityScores: options.popularityScores ?? null,
      });

      for (const comparator of comparators) {
        const result = comparator(left, right);

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  }

  private getComparatorsForSortMode(
    sortMode: SearchSortMode,
    options: {
      coordinates: { lat: number; lng: number } | null;
      defaultPrioritizeAvailability: boolean;
      relevanceScores: RelevanceScoreMap | null;
      popularityScores: PopularityScoreMap | null;
    },
  ): Array<(left: DiscoveryItem, right: DiscoveryItem) => number> {
    const fallbackComparators = this.buildFallbackComparators(
      options.coordinates,
      false,
      options.relevanceScores,
    );

    switch (sortMode) {
      case SearchSortMode.PROXIMITY:
        return [
          (left, right) =>
            this.compareByDistance(left, right, options.coordinates),
          ...fallbackComparators,
        ];
      case SearchSortMode.RATING:
        return [
          this.compareByRating.bind(this),
          this.compareByReviewCount.bind(this),
          ...fallbackComparators,
        ];
      case SearchSortMode.PRICE_LOW:
        return [
          (left, right) => this.compareByPrice(left, right, 'asc'),
          ...fallbackComparators,
        ];
      case SearchSortMode.PRICE_HIGH:
        return [
          (left, right) => this.compareByPrice(left, right, 'desc'),
          ...fallbackComparators,
        ];
      case SearchSortMode.POPULARITY:
        return [
          (left, right) =>
            this.compareByPopularity(
              left,
              right,
              options.popularityScores ?? new Map<string, number>(),
            ),
          ...fallbackComparators,
        ];
      case SearchSortMode.AVAILABILITY:
        return [
          this.compareByAvailability.bind(this),
          ...this.buildFallbackComparators(
            options.coordinates,
            false,
            options.relevanceScores,
          ),
        ];
      case SearchSortMode.RELEVANCE:
      default:
        return this.buildFallbackComparators(
          options.coordinates,
          options.defaultPrioritizeAvailability,
          options.relevanceScores,
        );
    }
  }

  private buildFallbackComparators(
    coordinates: { lat: number; lng: number } | null,
    prioritizeAvailability: boolean,
    relevanceScores: RelevanceScoreMap | null,
  ): Array<(left: DiscoveryItem, right: DiscoveryItem) => number> {
    return [
      ...(prioritizeAvailability
        ? [this.compareByAvailability.bind(this)]
        : []),
      ...(relevanceScores && relevanceScores.size > 0
        ? [
            (left: DiscoveryItem, right: DiscoveryItem) =>
              this.compareByRelevance(left, right, relevanceScores),
          ]
        : []),
      ...(coordinates
        ? [
            (left: DiscoveryItem, right: DiscoveryItem) =>
              this.compareByDistance(left, right, coordinates),
          ]
        : []),
      this.compareByVisibility.bind(this),
      this.compareByRating.bind(this),
      this.compareByReviewCount.bind(this),
      this.compareByCreatedAt.bind(this),
      this.compareById.bind(this),
    ];
  }

  private compareByAvailability(
    left: DiscoveryItem,
    right: DiscoveryItem,
  ): number {
    const leftAvailabilityRank = left.availability?.isAvailable ? 1 : 0;
    const rightAvailabilityRank = right.availability?.isAvailable ? 1 : 0;

    return rightAvailabilityRank - leftAvailabilityRank;
  }

  private compareByDistance(
    left: DiscoveryItem,
    right: DiscoveryItem,
    coordinates: { lat: number; lng: number } | null,
  ): number {
    if (!coordinates) {
      return 0;
    }

    if (left.distanceKm !== null && right.distanceKm !== null) {
      return left.distanceKm - right.distanceKm;
    }

    if (left.distanceKm !== null) {
      return -1;
    }

    if (right.distanceKm !== null) {
      return 1;
    }

    return 0;
  }

  private compareByVisibility(
    left: DiscoveryItem,
    right: DiscoveryItem,
  ): number {
    return right.visibilityPriority - left.visibilityPriority;
  }

  private compareByRating(left: DiscoveryItem, right: DiscoveryItem): number {
    return (
      Number(right.ratingStats?.avgRating ?? 0) -
      Number(left.ratingStats?.avgRating ?? 0)
    );
  }

  private compareByReviewCount(
    left: DiscoveryItem,
    right: DiscoveryItem,
  ): number {
    return (
      (right.ratingStats?.reviewCount ?? 0) -
      (left.ratingStats?.reviewCount ?? 0)
    );
  }

  private compareByPrice(
    left: DiscoveryItem,
    right: DiscoveryItem,
    direction: 'asc' | 'desc',
  ): number {
    if (
      left.priceAmount === undefined ||
      left.priceAmount === null ||
      right.priceAmount === undefined ||
      right.priceAmount === null
    ) {
      if (left.priceAmount !== null && left.priceAmount !== undefined) {
        return -1;
      }

      if (right.priceAmount !== null && right.priceAmount !== undefined) {
        return 1;
      }

      return 0;
    }

    const leftPriceAmount = Number(left.priceAmount);
    const rightPriceAmount = Number(right.priceAmount);

    return direction === 'asc'
      ? leftPriceAmount - rightPriceAmount
      : rightPriceAmount - leftPriceAmount;
  }

  private compareByPopularity(
    left: DiscoveryItem,
    right: DiscoveryItem,
    popularityScores: PopularityScoreMap,
  ): number {
    return (
      (popularityScores.get(right.id) ?? 0) -
      (popularityScores.get(left.id) ?? 0)
    );
  }

  private compareByRelevance(
    left: DiscoveryItem,
    right: DiscoveryItem,
    relevanceScores: RelevanceScoreMap,
  ): number {
    return (
      (relevanceScores.get(right.id) ?? 0) - (relevanceScores.get(left.id) ?? 0)
    );
  }

  private compareByCreatedAt(
    left: DiscoveryItem,
    right: DiscoveryItem,
  ): number {
    return right.createdAt.getTime() - left.createdAt.getTime();
  }

  private compareById(left: DiscoveryItem, right: DiscoveryItem): number {
    return left.id.localeCompare(right.id);
  }

  private resolveCoordinates(
    query: SearchDiscoveryDto,
  ): { lat: number; lng: number } | null {
    if (query.lat === undefined && query.lng === undefined) {
      return null;
    }

    if (query.lat === undefined || query.lng === undefined) {
      throw new BadRequestException(
        'Both lat and lng are required for distance sorting.',
      );
    }

    return {
      lat: query.lat,
      lng: query.lng,
    };
  }

  private resolveRequiredCoordinates(query: SearchDiscoveryDto): {
    lat: number;
    lng: number;
  } {
    const coordinates = this.resolveCoordinates(query);

    if (!coordinates) {
      throw new BadRequestException(
        'lat and lng are required for nearby service discovery.',
      );
    }

    return coordinates;
  }

  private calculateAddressDistance(
    address:
      | {
          lat: number | null;
          lng: number | null;
        }
      | null
      | undefined,
    coordinates: { lat: number; lng: number } | null,
  ): number | null {
    if (
      !coordinates ||
      address?.lat === null ||
      address?.lat === undefined ||
      address?.lng === null ||
      address?.lng === undefined
    ) {
      return null;
    }

    return Number(
      calculateDistanceKm(
        coordinates.lat,
        coordinates.lng,
        address.lat,
        address.lng,
      ).toFixed(2),
    );
  }

  private isWithinRadius(
    distanceKm: number | null | undefined,
    radiusKm: number | undefined,
  ): boolean {
    if (
      radiusKm === undefined ||
      distanceKm === null ||
      distanceKm === undefined
    ) {
      return true;
    }

    return distanceKm <= radiusKm;
  }

  private resolveCursorOffset(cursor: string | undefined): number {
    if (!cursor) {
      return 0;
    }

    try {
      const decodedValue = Buffer.from(cursor, 'base64url').toString('utf8');
      const payload = JSON.parse(decodedValue) as DiscoveryCursorPayload;

      if (
        typeof payload.offset !== 'number' ||
        !Number.isInteger(payload.offset) ||
        payload.offset < 0
      ) {
        throw new Error('Invalid discovery cursor payload.');
      }

      return payload.offset;
    } catch {
      throw new BadRequestException('cursor must be a valid discovery cursor.');
    }
  }

  private encodeCursor(payload: DiscoveryCursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private paginateDiscoveryItems<T extends DiscoveryItem>(
    items: T[],
    limit: number,
    cursorOffset: number,
  ): DiscoveryPage<T> {
    const nextOffset = cursorOffset + limit;
    const pageItems = items.slice(cursorOffset, nextOffset);
    const hasMore = items.length > nextOffset;

    return {
      items: pageItems,
      pageInfo: {
        nextCursor: hasMore
          ? this.encodeCursor({
              offset: nextOffset,
            })
          : null,
        hasMore,
        limit,
      },
    };
  }

  private resolveFetchTake(
    limit: number,
    cursorOffset: number,
    multiplier: number,
  ): number {
    return (cursorOffset + limit + 1) * multiplier;
  }

  private resolveGeoBounds(
    query: SearchDiscoveryDto,
    coordinates: { lat: number; lng: number } | null,
  ): GeoBounds | null {
    if (!coordinates || query.radiusKm === undefined) {
      return null;
    }

    const latDelta = query.radiusKm / 111.32;
    const cosLatitude = Math.cos((coordinates.lat * Math.PI) / 180);
    const safeCosLatitude =
      Math.abs(cosLatitude) < 0.01 ? 0.01 : Math.abs(cosLatitude);
    const lngDelta = query.radiusKm / (111.32 * safeCosLatitude);

    return {
      minLat: coordinates.lat - latDelta,
      maxLat: coordinates.lat + latDelta,
      minLng: coordinates.lng - lngDelta,
      maxLng: coordinates.lng + lngDelta,
    };
  }

  private normalizeSearchQuery(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalizedValue = value.trim().replace(/\s+/g, ' ');

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private buildRelevanceScoreMap(
    hits: RankedSearchHit[],
  ): RelevanceScoreMap | null {
    return new Map(hits.map((hit) => [hit.id, hit.relevanceScore]));
  }

  private orderRecordsByHits<T extends { id: string }>(
    records: T[],
    hits: RankedSearchHit[],
  ): T[] {
    const orderById = new Map(hits.map((hit, index) => [hit.id, index]));

    return [...records].sort(
      (left, right) =>
        (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }
}

type DiscoveryItem = {
  [key: string]: unknown;
  id: string;
  name: string;
  createdAt: Date;
  distanceKm: number | null;
  availability?: ServiceAvailabilitySnapshot | null;
  priceAmount?: Prisma.Decimal | number | null;
  ratingStats?: {
    avgRating: Prisma.Decimal | number;
    reviewCount: number;
  } | null;
  visibilityPriority: number;
};

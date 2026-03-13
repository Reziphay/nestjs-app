import { BadRequestException, Injectable } from '@nestjs/common';
import { AppRole, BrandStatus, Prisma, UserStatus } from '@prisma/client';

import { calculateDistanceKm } from '../common/utils/geo.util';
import {
  getMaxActiveVisibilityPriority,
  serializeActiveVisibilityLabels,
} from '../common/utils/visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDiscoveryDto } from './dto/search-discovery.dto';

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
  visibilityAssignments: activeVisibilityLabelInclude,
} satisfies Prisma.BrandInclude;

const providerSearchInclude = {
  serviceOwnerRatingStat: {
    select: {
      avgRating: true,
      reviewCount: true,
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

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchDiscovery(
    query: SearchDiscoveryDto,
  ): Promise<Record<string, unknown>> {
    const coordinates = this.resolveCoordinates(query);
    const now = new Date();
    const limit = query.limit ?? 10;

    const [services, brands, providers] = await Promise.all([
      this.searchServices(query, limit * 3),
      this.searchBrands(query, limit * 3),
      this.searchProviders(query, limit * 3),
    ]);

    const sortedServices = this.sortByDiscoveryPriority(
      services
        .map((service) =>
          this.serializeServiceResult(service, now, coordinates),
        )
        .filter((service) =>
          this.isWithinRadius(service.distanceKm, query.radiusKm),
        ),
      coordinates,
    ).slice(0, limit);
    const sortedBrands = this.sortByDiscoveryPriority(
      brands
        .map((brand) => this.serializeBrandResult(brand, now, coordinates))
        .filter((brand) =>
          this.isWithinRadius(brand.distanceKm, query.radiusKm),
        ),
      coordinates,
    ).slice(0, limit);
    const sortedProviders = this.sortByDiscoveryPriority(
      providers
        .map((provider) =>
          this.serializeProviderResult(provider, now, coordinates),
        )
        .filter((provider) =>
          this.isWithinRadius(provider.distanceKm, query.radiusKm),
        ),
      coordinates,
    ).slice(0, limit);

    return {
      services: sortedServices,
      brands: sortedBrands,
      providers: sortedProviders,
    };
  }

  private async searchServices(
    query: SearchDiscoveryDto,
    take: number,
  ): Promise<ServiceSearchRecord[]> {
    const activeVisibilityWhere = query.visibilityLabelSlug
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

    return this.prisma.service.findMany({
      where: {
        isActive: true,
        ownerUser: {
          is: {
            status: UserStatus.ACTIVE,
          },
        },
        ...(query.q
          ? {
              OR: [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  brand: {
                    is: {
                      name: {
                        contains: query.q,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
                {
                  ownerUser: {
                    is: {
                      fullName: {
                        contains: query.q,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
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
        ...activeVisibilityWhere,
      },
      include: serviceSearchInclude,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async searchBrands(
    query: SearchDiscoveryDto,
    take: number,
  ): Promise<BrandSearchRecord[]> {
    return this.prisma.brand.findMany({
      where: {
        status: BrandStatus.ACTIVE,
        ...(query.q
          ? {
              OR: [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  owner: {
                    is: {
                      fullName: {
                        contains: query.q,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
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
    });
  }

  private async searchProviders(
    query: SearchDiscoveryDto,
    take: number,
  ): Promise<ProviderSearchRecord[]> {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            role: AppRole.USO,
          },
        },
        ...(query.ownerUserId ? { id: query.ownerUserId } : {}),
        ...(query.q
          ? {
              OR: [
                {
                  fullName: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  services: {
                    some: {
                      isActive: true,
                      name: {
                        contains: query.q,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
                {
                  ownedBrands: {
                    some: {
                      name: {
                        contains: query.q,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
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
    });
  }

  private serializeServiceResult(
    service: ServiceSearchRecord,
    now: Date,
    coordinates: { lat: number; lng: number } | null,
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

  private sortByDiscoveryPriority<T extends DiscoveryItem>(
    items: T[],
    coordinates: { lat: number; lng: number } | null,
  ): T[] {
    return [...items].sort((left, right) => {
      if (coordinates) {
        if (left.distanceKm !== null && right.distanceKm !== null) {
          if (left.distanceKm !== right.distanceKm) {
            return left.distanceKm - right.distanceKm;
          }
        } else if (left.distanceKm !== null) {
          return -1;
        } else if (right.distanceKm !== null) {
          return 1;
        }
      }

      if (right.visibilityPriority !== left.visibilityPriority) {
        return right.visibilityPriority - left.visibilityPriority;
      }

      const leftRating = Number(left.ratingStats?.avgRating ?? 0);
      const rightRating = Number(right.ratingStats?.avgRating ?? 0);
      if (rightRating !== leftRating) {
        return rightRating - leftRating;
      }

      const leftReviewCount = left.ratingStats?.reviewCount ?? 0;
      const rightReviewCount = right.ratingStats?.reviewCount ?? 0;
      if (rightReviewCount !== leftReviewCount) {
        return rightReviewCount - leftReviewCount;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
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
}

type DiscoveryItem = {
  [key: string]: unknown;
  id: string;
  name: string;
  createdAt: Date;
  distanceKm: number | null;
  ratingStats?: {
    avgRating: Prisma.Decimal | number;
    reviewCount: number;
  } | null;
  visibilityPriority: number;
};

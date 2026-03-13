import { Injectable } from '@nestjs/common';
import { AppRole, BrandStatus, Prisma, UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type SearchDocumentDbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SearchDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncServiceDocument(
    serviceId: string,
    db: SearchDocumentDbClient = this.prisma,
  ): Promise<void> {
    const service = await db.service.findUnique({
      where: {
        id: serviceId,
      },
      select: {
        id: true,
        isActive: true,
        name: true,
        description: true,
        ownerUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        address: {
          select: {
            city: true,
            country: true,
          },
        },
      },
    });

    if (!service || !service.isActive) {
      await db.serviceSearchDocument.deleteMany({
        where: {
          serviceId,
        },
      });

      if (service?.ownerUser.id) {
        await this.syncProviderDocument(service.ownerUser.id, db);
      }

      return;
    }

    const payload = {
      serviceName: service.name,
      brandName: service.brand?.name ?? null,
      ownerFullName: service.ownerUser.fullName,
      categoryName: service.category?.name ?? null,
      city: service.address?.city ?? null,
      country: service.address?.country ?? null,
      searchText: this.buildSearchText([
        service.name,
        service.description,
        service.brand?.name,
        service.ownerUser.fullName,
        service.category?.name,
        service.address?.city,
        service.address?.country,
      ]),
    };

    await db.serviceSearchDocument.upsert({
      where: {
        serviceId: service.id,
      },
      update: payload,
      create: {
        serviceId: service.id,
        ...payload,
      },
    });

    await this.syncProviderDocument(service.ownerUser.id, db);
  }

  async syncBrandDocument(
    brandId: string,
    db: SearchDocumentDbClient = this.prisma,
  ): Promise<void> {
    const brand = await db.brand.findUnique({
      where: {
        id: brandId,
      },
      select: {
        id: true,
        status: true,
        name: true,
        description: true,
        ownerUserId: true,
        owner: {
          select: {
            fullName: true,
          },
        },
        addresses: {
          where: {
            isPrimary: true,
          },
          take: 1,
          select: {
            city: true,
            country: true,
          },
        },
      },
    });

    if (!brand || brand.status !== BrandStatus.ACTIVE) {
      await db.brandSearchDocument.deleteMany({
        where: {
          brandId,
        },
      });

      if (brand?.ownerUserId) {
        await this.syncProviderDocument(brand.ownerUserId, db);
      }

      return;
    }

    const primaryAddress = brand.addresses[0] ?? null;
    const payload = {
      brandName: brand.name,
      ownerFullName: brand.owner.fullName,
      city: primaryAddress?.city ?? null,
      country: primaryAddress?.country ?? null,
      searchText: this.buildSearchText([
        brand.name,
        brand.description,
        brand.owner.fullName,
        primaryAddress?.city,
        primaryAddress?.country,
      ]),
    };

    await db.brandSearchDocument.upsert({
      where: {
        brandId: brand.id,
      },
      update: payload,
      create: {
        brandId: brand.id,
        ...payload,
      },
    });

    await this.syncProviderDocument(brand.ownerUserId, db);
  }

  async syncProviderDocument(
    userId: string,
    db: SearchDocumentDbClient = this.prisma,
  ): Promise<void> {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        fullName: true,
        status: true,
        roles: {
          where: {
            role: AppRole.USO,
          },
          select: {
            id: true,
          },
        },
        services: {
          where: {
            isActive: true,
          },
          select: {
            name: true,
            address: {
              select: {
                city: true,
                country: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        ownedBrands: {
          where: {
            status: BrandStatus.ACTIVE,
          },
          select: {
            name: true,
            addresses: {
              where: {
                isPrimary: true,
              },
              take: 1,
              select: {
                city: true,
                country: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.roles.length === 0) {
      await db.providerSearchDocument.deleteMany({
        where: {
          userId,
        },
      });

      return;
    }

    const serviceNames = this.joinUniqueValues(
      user.services.map((service) => service.name),
    );
    const brandNames = this.joinUniqueValues(
      user.ownedBrands.map((brand) => brand.name),
    );
    const cityNames = this.joinUniqueValues([
      ...user.services.map((service) => service.address?.city ?? null),
      ...user.ownedBrands.map((brand) => brand.addresses[0]?.city ?? null),
    ]);
    const countryNames = this.joinUniqueValues([
      ...user.services.map((service) => service.address?.country ?? null),
      ...user.ownedBrands.map((brand) => brand.addresses[0]?.country ?? null),
    ]);

    const payload = {
      fullName: user.fullName,
      serviceNames,
      brandNames,
      cityNames,
      countryNames,
      searchText: this.buildSearchText([
        user.fullName,
        serviceNames,
        brandNames,
        cityNames,
        countryNames,
      ]),
    };

    await db.providerSearchDocument.upsert({
      where: {
        userId: user.id,
      },
      update: payload,
      create: {
        userId: user.id,
        ...payload,
      },
    });
  }

  async rebuildAllDocuments(
    db: SearchDocumentDbClient = this.prisma,
  ): Promise<void> {
    const [serviceIds, brandIds, providerIds] = await Promise.all([
      db.service.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
      db.brand.findMany({
        where: {
          status: BrandStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      }),
      db.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          roles: {
            some: {
              role: AppRole.USO,
            },
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    await db.serviceSearchDocument.deleteMany();
    await db.brandSearchDocument.deleteMany();
    await db.providerSearchDocument.deleteMany();

    for (const service of serviceIds) {
      await this.syncServiceDocument(service.id, db);
    }

    for (const brand of brandIds) {
      await this.syncBrandDocument(brand.id, db);
    }

    for (const provider of providerIds) {
      await this.syncProviderDocument(provider.id, db);
    }
  }

  private buildSearchText(values: Array<string | null | undefined>): string {
    return values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }

  private joinUniqueValues(
    values: Array<string | null | undefined>,
  ): string | null {
    const uniqueValues = [
      ...new Set(
        values
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    return uniqueValues.length > 0 ? uniqueValues.join(' ') : null;
  }
}

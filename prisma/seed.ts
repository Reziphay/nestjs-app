import 'dotenv/config';

import {
  AppRole,
  ApprovalMode,
  BrandMembershipRole,
  BrandMembershipStatus,
  BrandStatus,
  PrismaClient,
  ServiceType,
  UserStatus,
  VisibilityTargetType,
} from '@prisma/client';

const prisma = new PrismaClient();

function buildSearchText(values: Array<string | null | undefined>): string {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function joinUniqueValues(
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

async function rebuildSearchDocuments(): Promise<void> {
  await prisma.serviceSearchDocument.deleteMany();
  await prisma.brandSearchDocument.deleteMany();
  await prisma.providerSearchDocument.deleteMany();

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
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

  if (services.length > 0) {
    await prisma.serviceSearchDocument.createMany({
      data: services.map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        brandName: service.brand?.name ?? null,
        ownerFullName: service.ownerUser.fullName,
        categoryName: service.category?.name ?? null,
        city: service.address?.city ?? null,
        country: service.address?.country ?? null,
        searchText: buildSearchText([
          service.name,
          service.description,
          service.brand?.name,
          service.ownerUser.fullName,
          service.category?.name,
          service.address?.city,
          service.address?.country,
        ]),
      })),
    });
  }

  const brands = await prisma.brand.findMany({
    where: {
      status: BrandStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      description: true,
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

  if (brands.length > 0) {
    await prisma.brandSearchDocument.createMany({
      data: brands.map((brand) => ({
        brandId: brand.id,
        brandName: brand.name,
        ownerFullName: brand.owner.fullName,
        city: brand.addresses[0]?.city ?? null,
        country: brand.addresses[0]?.country ?? null,
        searchText: buildSearchText([
          brand.name,
          brand.description,
          brand.owner.fullName,
          brand.addresses[0]?.city,
          brand.addresses[0]?.country,
        ]),
      })),
    });
  }

  const providers = await prisma.user.findMany({
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
      fullName: true,
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
      },
    },
  });

  if (providers.length > 0) {
    await prisma.providerSearchDocument.createMany({
      data: providers.map((provider) => {
        const serviceNames = joinUniqueValues(
          provider.services.map((service) => service.name),
        );
        const brandNames = joinUniqueValues(
          provider.ownedBrands.map((brand) => brand.name),
        );
        const cityNames = joinUniqueValues([
          ...provider.services.map((service) => service.address?.city ?? null),
          ...provider.ownedBrands.map(
            (brand) => brand.addresses[0]?.city ?? null,
          ),
        ]);
        const countryNames = joinUniqueValues([
          ...provider.services.map(
            (service) => service.address?.country ?? null,
          ),
          ...provider.ownedBrands.map(
            (brand) => brand.addresses[0]?.country ?? null,
          ),
        ]);

        return {
          userId: provider.id,
          fullName: provider.fullName,
          serviceNames,
          brandNames,
          cityNames,
          countryNames,
          searchText: buildSearchText([
            provider.fullName,
            serviceNames,
            brandNames,
            cityNames,
            countryNames,
          ]),
        };
      }),
    });
  }
}

async function main(): Promise<void> {
  const users = [
    {
      fullName: 'Reziphay Admin',
      email: 'admin@reziphay.local',
      phone: '+10000000001',
      roles: [AppRole.ADMIN, AppRole.UCR],
    },
    {
      fullName: 'Demo Customer',
      email: 'customer@reziphay.local',
      phone: '+10000000002',
      roles: [AppRole.UCR],
    },
    {
      fullName: 'Demo Service Owner',
      email: 'uso@reziphay.local',
      phone: '+10000000003',
      roles: [AppRole.UCR, AppRole.USO],
    },
  ];

  for (const seedUser of users) {
    const user = await prisma.user.upsert({
      where: {
        phone: seedUser.phone,
      },
      update: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
      create: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        phone: seedUser.phone,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
    });

    for (const role of seedUser.roles) {
      await prisma.userRole.upsert({
        where: {
          userId_role: {
            userId: user.id,
            role,
          },
        },
        update: {},
        create: {
          userId: user.id,
          role,
        },
      });
    }
  }

  const categories = [
    {
      name: 'Barber',
      slug: 'barber',
    },
    {
      name: 'Dentistry',
      slug: 'dentistry',
    },
    {
      name: 'Beauty',
      slug: 'beauty',
    },
  ];

  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        isActive: true,
      },
    });
  }

  const demoOwner = await prisma.user.findUniqueOrThrow({
    where: {
      phone: '+10000000003',
    },
  });
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: {
      phone: '+10000000001',
    },
  });

  const barberCategory = await prisma.serviceCategory.findUniqueOrThrow({
    where: {
      slug: 'barber',
    },
  });

  let demoBrand = await prisma.brand.findFirst({
    where: {
      ownerUserId: demoOwner.id,
      name: 'Studio Reziphay',
    },
  });

  if (!demoBrand) {
    demoBrand = await prisma.brand.create({
      data: {
        ownerUserId: demoOwner.id,
        name: 'Studio Reziphay',
        description: 'Demo studio for backend development.',
        status: BrandStatus.ACTIVE,
      },
    });
  }

  await prisma.brandMembership.upsert({
    where: {
      brandId_userId: {
        brandId: demoBrand.id,
        userId: demoOwner.id,
      },
    },
    update: {
      membershipRole: BrandMembershipRole.OWNER,
      status: BrandMembershipStatus.ACTIVE,
    },
    create: {
      brandId: demoBrand.id,
      userId: demoOwner.id,
      membershipRole: BrandMembershipRole.OWNER,
      status: BrandMembershipStatus.ACTIVE,
    },
  });

  const primaryBrandAddress = await prisma.brandAddress.findFirst({
    where: {
      brandId: demoBrand.id,
      isPrimary: true,
    },
  });

  if (primaryBrandAddress) {
    await prisma.brandAddress.update({
      where: {
        id: primaryBrandAddress.id,
      },
      data: {
        fullAddress: '123 Demo Street',
        country: 'Azerbaijan',
        city: 'Baku',
        lat: 40.4093,
        lng: 49.8671,
      },
    });
  } else {
    await prisma.brandAddress.create({
      data: {
        brandId: demoBrand.id,
        label: 'Main Studio',
        fullAddress: '123 Demo Street',
        country: 'Azerbaijan',
        city: 'Baku',
        lat: 40.4093,
        lng: 49.8671,
        isPrimary: true,
      },
    });
  }

  let demoServiceAddress = await prisma.serviceAddress.findFirst({
    where: {
      ownerUserId: demoOwner.id,
      fullAddress: '123 Demo Street',
    },
  });

  if (!demoServiceAddress) {
    demoServiceAddress = await prisma.serviceAddress.create({
      data: {
        brandId: demoBrand.id,
        ownerUserId: demoOwner.id,
        label: 'Chair 1',
        fullAddress: '123 Demo Street',
        country: 'Azerbaijan',
        city: 'Baku',
        lat: 40.4093,
        lng: 49.8671,
      },
    });
  }

  let demoService = await prisma.service.findFirst({
    where: {
      ownerUserId: demoOwner.id,
      name: 'Classic Haircut',
    },
  });

  if (!demoService) {
    demoService = await prisma.service.create({
      data: {
        ownerUserId: demoOwner.id,
        brandId: demoBrand.id,
        categoryId: barberCategory.id,
        addressId: demoServiceAddress.id,
        name: 'Classic Haircut',
        description: 'Demo seeded service for the MVP backend.',
        priceAmount: 25,
        priceCurrency: 'AZN',
        waitingTimeMinutes: 15,
        minAdvanceMinutes: 60,
        maxAdvanceMinutes: 14 * 24 * 60,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        freeCancellationDeadlineMinutes: 120,
        isActive: true,
      },
    });
  } else {
    await prisma.service.update({
      where: {
        id: demoService.id,
      },
      data: {
        brandId: demoBrand.id,
        categoryId: barberCategory.id,
        addressId: demoServiceAddress.id,
        priceAmount: 25,
        priceCurrency: 'AZN',
        waitingTimeMinutes: 15,
        minAdvanceMinutes: 60,
        maxAdvanceMinutes: 14 * 24 * 60,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        freeCancellationDeadlineMinutes: 120,
        isActive: true,
      },
    });
  }

  await prisma.serviceAvailabilityRule.deleteMany({
    where: {
      serviceId: demoService.id,
    },
  });

  await prisma.serviceAvailabilityRule.createMany({
    data: [
      {
        serviceId: demoService.id,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      },
      {
        serviceId: demoService.id,
        dayOfWeek: 'TUESDAY',
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      },
      {
        serviceId: demoService.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      },
    ],
  });

  const visibilityLabels = [
    {
      targetType: VisibilityTargetType.BRAND,
      name: 'Featured',
      slug: 'featured',
      description: 'Highlights a brand in discovery.',
      priority: 80,
    },
    {
      targetType: VisibilityTargetType.SERVICE,
      name: 'Sponsored',
      slug: 'sponsored',
      description: 'Prioritizes a service in discovery.',
      priority: 100,
    },
    {
      targetType: VisibilityTargetType.USER,
      name: 'VIP',
      slug: 'vip',
      description: 'Highlights a provider profile in discovery.',
      priority: 60,
    },
  ];

  for (const visibilityLabel of visibilityLabels) {
    await prisma.visibilityLabel.upsert({
      where: {
        targetType_slug: {
          targetType: visibilityLabel.targetType,
          slug: visibilityLabel.slug,
        },
      },
      update: {
        name: visibilityLabel.name,
        description: visibilityLabel.description,
        priority: visibilityLabel.priority,
        isActive: true,
        createdByAdminId: adminUser.id,
      },
      create: {
        ...visibilityLabel,
        isActive: true,
        createdByAdminId: adminUser.id,
      },
    });
  }

  const featuredBrandLabel = await prisma.visibilityLabel.findUniqueOrThrow({
    where: {
      targetType_slug: {
        targetType: VisibilityTargetType.BRAND,
        slug: 'featured',
      },
    },
  });
  const sponsoredServiceLabel = await prisma.visibilityLabel.findUniqueOrThrow({
    where: {
      targetType_slug: {
        targetType: VisibilityTargetType.SERVICE,
        slug: 'sponsored',
      },
    },
  });
  const vipUserLabel = await prisma.visibilityLabel.findUniqueOrThrow({
    where: {
      targetType_slug: {
        targetType: VisibilityTargetType.USER,
        slug: 'vip',
      },
    },
  });

  await prisma.brandVisibilityAssignment.deleteMany({
    where: {
      brandId: demoBrand.id,
    },
  });
  await prisma.serviceVisibilityAssignment.deleteMany({
    where: {
      serviceId: demoService.id,
    },
  });
  await prisma.userVisibilityAssignment.deleteMany({
    where: {
      userId: demoOwner.id,
    },
  });

  await prisma.brandVisibilityAssignment.create({
    data: {
      labelId: featuredBrandLabel.id,
      brandId: demoBrand.id,
      createdByAdminId: adminUser.id,
    },
  });

  await prisma.serviceVisibilityAssignment.create({
    data: {
      labelId: sponsoredServiceLabel.id,
      serviceId: demoService.id,
      createdByAdminId: adminUser.id,
    },
  });

  await prisma.userVisibilityAssignment.create({
    data: {
      labelId: vipUserLabel.id,
      userId: demoOwner.id,
      createdByAdminId: adminUser.id,
    },
  });

  await rebuildSearchDocuments();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

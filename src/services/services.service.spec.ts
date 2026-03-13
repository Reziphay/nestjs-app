/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { ApprovalMode, ServiceType } from '@prisma/client';

import { ServicesService } from './services.service';

describe('ServicesService', () => {
  it('creates a service for a USO with brand membership and availability rules', async () => {
    const searchDocumentsService = {
      syncServiceDocument: jest.fn().mockResolvedValue(undefined),
    } as any;
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'uso-1',
      role: 'USO',
    });
    const brandFindUnique = jest.fn().mockResolvedValue({
      id: 'brand-1',
      status: 'ACTIVE',
    });
    const serviceCategoryFindUnique = jest.fn().mockResolvedValue({
      id: 'category-1',
      isActive: true,
    });
    const serviceAddressCreate = jest.fn().mockResolvedValue({
      id: 'address-1',
    });
    const serviceCreate = jest.fn().mockResolvedValue({
      id: 'service-1',
    });
    const availabilityCreateMany = jest.fn().mockResolvedValue(undefined);
    const availabilityExceptionCreateMany = jest
      .fn()
      .mockResolvedValue(undefined);
    const serviceFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'service-1',
      name: 'Classic Haircut',
      description: 'Seeded service',
      ownerUser: {
        id: 'uso-1',
        fullName: 'Demo Owner',
      },
      brand: {
        id: 'brand-1',
        name: 'Studio Reziphay',
        status: 'ACTIVE',
      },
      category: {
        id: 'category-1',
        name: 'Barber',
        slug: 'barber',
      },
      address: {
        id: 'address-1',
      },
      priceAmount: 25,
      priceCurrency: 'AZN',
      waitingTimeMinutes: 15,
      minAdvanceMinutes: 60,
      maxAdvanceMinutes: 120,
      serviceType: ServiceType.SOLO,
      approvalMode: ApprovalMode.MANUAL,
      freeCancellationDeadlineMinutes: 120,
      isActive: true,
      photos: [],
      availabilityRules: [
        {
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '18:00',
        },
      ],
      availabilityExceptions: [],
      manualBlocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      brand: {
        findUnique: brandFindUnique,
      },
      serviceCategory: {
        findUnique: serviceCategoryFindUnique,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              serviceAddress: {
                create: serviceAddressCreate,
              },
              service: {
                create: serviceCreate,
                findUniqueOrThrow: serviceFindUniqueOrThrow,
              },
              serviceAvailabilityRule: {
                createMany: availabilityCreateMany,
              },
              serviceAvailabilityException: {
                createMany: availabilityExceptionCreateMany,
              },
            }),
          ),
      ),
    } as any;

    const brandsService = {
      assertActiveMembership: jest.fn().mockResolvedValue(undefined),
    } as any;
    const storageService = {} as any;

    const service = new ServicesService(
      prisma,
      brandsService,
      storageService,
      searchDocumentsService,
    );

    const result = await service.createService('uso-1', {
      brandId: 'brand-1',
      categoryId: 'category-1',
      address: {
        fullAddress: '123 Demo Street',
        country: 'Azerbaijan',
        city: 'Baku',
      },
      name: 'Classic Haircut',
      description: 'Seeded service',
      priceAmount: 25,
      priceCurrency: 'AZN',
      waitingTimeMinutes: 15,
      minAdvanceMinutes: 60,
      maxAdvanceMinutes: 120,
      serviceType: ServiceType.SOLO,
      approvalMode: ApprovalMode.MANUAL,
      freeCancellationDeadlineMinutes: 120,
      availabilityRules: [
        {
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '18:00',
        },
      ],
    });

    expect(brandsService.assertActiveMembership).toHaveBeenCalledWith(
      'brand-1',
      'uso-1',
    );
    expect(serviceCreate).toHaveBeenCalledWith({
      data: {
        ownerUserId: 'uso-1',
        brandId: 'brand-1',
        categoryId: 'category-1',
        addressId: 'address-1',
        name: 'Classic Haircut',
        description: 'Seeded service',
        priceAmount: 25,
        priceCurrency: 'AZN',
        waitingTimeMinutes: 15,
        minAdvanceMinutes: 60,
        maxAdvanceMinutes: 120,
        serviceType: ServiceType.SOLO,
        approvalMode: ApprovalMode.MANUAL,
        freeCancellationDeadlineMinutes: 120,
      },
    });
    expect(availabilityCreateMany).toHaveBeenCalled();
    expect(searchDocumentsService.syncServiceDocument).toHaveBeenCalledWith(
      'service-1',
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        service: expect.objectContaining({
          id: 'service-1',
          name: 'Classic Haircut',
        }),
      }),
    );
  });

  it('replaces manual blocks for an owned service', async () => {
    const serviceFindUnique = jest.fn().mockResolvedValue({
      id: 'service-1',
      ownerUserId: 'uso-1',
    });
    const manualBlockDeleteMany = jest.fn().mockResolvedValue(undefined);
    const manualBlockCreateMany = jest.fn().mockResolvedValue(undefined);
    const manualBlockFindMany = jest.fn().mockResolvedValue([
      {
        id: 'block-1',
        serviceId: 'service-1',
        startsAt: new Date('2026-04-05T10:00:00.000Z'),
        endsAt: new Date('2026-04-05T11:30:00.000Z'),
        reason: 'Private booking',
      },
    ]);

    const prisma = {
      service: {
        findUnique: serviceFindUnique,
      },
      serviceManualBlock: {
        deleteMany: manualBlockDeleteMany,
        createMany: manualBlockCreateMany,
        findMany: manualBlockFindMany,
      },
      serviceAvailabilityRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceAvailabilityException: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new ServicesService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.replaceManualBlocks('uso-1', 'service-1', {
      blocks: [
        {
          startsAt: '2026-04-05T10:00:00.000Z',
          endsAt: '2026-04-05T11:30:00.000Z',
          reason: 'Private booking',
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(manualBlockDeleteMany).toHaveBeenCalledWith({
      where: {
        serviceId: 'service-1',
      },
    });
    expect(manualBlockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          serviceId: 'service-1',
          startsAt: new Date('2026-04-05T10:00:00.000Z'),
          endsAt: new Date('2026-04-05T11:30:00.000Z'),
          reason: 'Private booking',
        },
      ],
    });
    expect(result).toEqual({
      rules: [],
      exceptions: [],
      manualBlocks: [
        expect.objectContaining({
          id: 'block-1',
          reason: 'Private booking',
        }),
      ],
    });
  });

  it('does not archive a service when active reservations exist', async () => {
    const serviceFindUnique = jest.fn().mockResolvedValue({
      id: 'service-1',
      ownerUserId: 'uso-1',
      brandId: null,
      categoryId: null,
      addressId: null,
      name: 'Classic Haircut',
      description: null,
      priceAmount: null,
      priceCurrency: null,
      waitingTimeMinutes: 15,
      minAdvanceMinutes: null,
      maxAdvanceMinutes: null,
      serviceType: ServiceType.SOLO,
      approvalMode: ApprovalMode.MANUAL,
      freeCancellationDeadlineMinutes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const reservationCount = jest.fn().mockResolvedValue(1);

    const prisma = {
      service: {
        findUnique: serviceFindUnique,
      },
      reservation: {
        count: reservationCount,
      },
    } as any;

    const brandsService = {} as any;
    const storageService = {} as any;

    const service = new ServicesService(
      prisma,
      brandsService,
      storageService,
      {} as any,
    );

    await expect(service.archiveService('uso-1', 'service-1')).rejects.toThrow(
      'Services with active reservations cannot be archived.',
    );
    expect(reservationCount).toHaveBeenCalledWith({
      where: {
        serviceId: 'service-1',
        status: {
          in: [
            'PENDING',
            'CONFIRMED',
            'CHANGE_REQUESTED_BY_CUSTOMER',
            'CHANGE_REQUESTED_BY_OWNER',
          ],
        },
      },
    });
  });
});

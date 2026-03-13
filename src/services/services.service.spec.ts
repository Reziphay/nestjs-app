/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { ApprovalMode, ServiceType } from '@prisma/client';

import { ServicesService } from './services.service';

describe('ServicesService', () => {
  it('creates a service for a USO with brand membership and availability rules', async () => {
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

    const service = new ServicesService(prisma, brandsService, storageService);

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
    expect(result).toEqual(
      expect.objectContaining({
        service: expect.objectContaining({
          id: 'service-1',
          name: 'Classic Haircut',
        }),
      }),
    );
  });
});

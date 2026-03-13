/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { BrandMembershipRole, BrandMembershipStatus } from '@prisma/client';

import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  it('creates a brand for a USO and provisions owner membership and address', async () => {
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'uso-1',
      role: 'USO',
    });
    const fileObjectFindUnique = jest.fn().mockResolvedValue(null);
    const brandCreate = jest.fn().mockResolvedValue({
      id: 'brand-1',
    });
    const brandAddressCreate = jest.fn().mockResolvedValue(undefined);
    const brandMembershipCreate = jest.fn().mockResolvedValue(undefined);
    const brandFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'brand-1',
      name: 'Studio Reziphay',
      description: 'Demo brand',
      status: 'ACTIVE',
      logoFileId: null,
      owner: {
        id: 'uso-1',
        fullName: 'Demo Owner',
      },
      addresses: [
        {
          id: 'address-1',
          label: 'Main',
          fullAddress: '123 Demo Street',
          country: 'Azerbaijan',
          city: 'Baku',
          lat: 40.4,
          lng: 49.8,
          placeId: null,
          isPrimary: true,
        },
      ],
      memberships: [{ id: 'membership-1' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      fileObject: {
        findUnique: fileObjectFindUnique,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              brand: {
                create: brandCreate,
                findUniqueOrThrow: brandFindUniqueOrThrow,
              },
              brandAddress: {
                create: brandAddressCreate,
              },
              brandMembership: {
                create: brandMembershipCreate,
              },
            }),
          ),
      ),
    } as any;

    const service = new BrandsService(prisma);

    const result = await service.createBrand('uso-1', {
      name: 'Studio Reziphay',
      description: 'Demo brand',
      primaryAddress: {
        label: 'Main',
        fullAddress: '123 Demo Street',
        country: 'Azerbaijan',
        city: 'Baku',
        lat: 40.4,
        lng: 49.8,
      },
    });

    expect(userRoleFindUnique).toHaveBeenCalledWith({
      where: {
        userId_role: {
          userId: 'uso-1',
          role: 'USO',
        },
      },
    });
    expect(brandCreate).toHaveBeenCalledWith({
      data: {
        ownerUserId: 'uso-1',
        logoFileId: null,
        name: 'Studio Reziphay',
        description: 'Demo brand',
      },
    });
    expect(brandAddressCreate).toHaveBeenCalled();
    expect(brandMembershipCreate).toHaveBeenCalledWith({
      data: {
        brandId: 'brand-1',
        userId: 'uso-1',
        membershipRole: BrandMembershipRole.OWNER,
        status: BrandMembershipStatus.ACTIVE,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        brand: expect.objectContaining({
          id: 'brand-1',
          name: 'Studio Reziphay',
          memberCount: 1,
        }),
      }),
    );
  });
});

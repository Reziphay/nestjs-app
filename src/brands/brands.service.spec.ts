/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { BrandMembershipRole, BrandMembershipStatus } from '@prisma/client';

import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  it('creates a brand for a USO and provisions owner membership and address', async () => {
    const syncBrandDocument = jest.fn().mockResolvedValue(undefined);
    const searchDocumentsService = {
      syncBrandDocument,
    } as const;
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

    const service = new BrandsService(
      prisma,
      {} as any,
      searchDocumentsService as any,
    );

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
    expect(syncBrandDocument).toHaveBeenCalledWith(
      'brand-1',
      expect.any(Object),
    );
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

  it('uploads and assigns a brand logo for the owner', async () => {
    const syncBrandDocument = jest.fn().mockResolvedValue(undefined);
    const searchDocumentsService = {
      syncBrandDocument,
    } as const;
    const brandFindUnique = jest.fn().mockResolvedValue({
      id: 'brand-1',
      ownerUserId: 'uso-1',
    });
    const uploadFile = jest.fn().mockResolvedValue({
      id: 'file-1',
    });
    const brandUpdate = jest.fn().mockResolvedValue({
      id: 'brand-1',
      name: 'Studio Reziphay',
      description: 'Demo brand',
      status: 'ACTIVE',
      logoFileId: 'file-1',
      logoFile: {
        id: 'file-1',
        bucket: 'reziphay-local',
        objectKey: 'brand-logos/file-1.png',
        originalFilename: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: 1234,
        uploadedByUserId: 'uso-1',
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
      },
      owner: {
        id: 'uso-1',
        fullName: 'Demo Owner',
      },
      addresses: [],
      memberships: [{ id: 'membership-1' }],
      brandRatingStat: null,
      visibilityAssignments: [],
      createdAt: new Date('2026-03-13T09:00:00.000Z'),
      updatedAt: new Date('2026-03-13T10:00:00.000Z'),
    });

    const prisma = {
      brand: {
        findUnique: brandFindUnique,
        update: brandUpdate,
      },
    } as any;

    const service = new BrandsService(
      prisma,
      {
        uploadFile,
      } as any,
      searchDocumentsService as any,
    );

    const result = await service.uploadLogo('uso-1', 'brand-1', {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 1234,
      buffer: Buffer.from('logo'),
    } as Express.Multer.File);

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'logo.png',
      }),
      'uso-1',
      'brand-logos',
    );
    expect(brandUpdate).toHaveBeenCalledWith({
      where: {
        id: 'brand-1',
      },
      data: {
        logoFileId: 'file-1',
      },
      include: expect.any(Object),
    });
    expect(syncBrandDocument).toHaveBeenCalledWith('brand-1');
    expect(result).toEqual(
      expect.objectContaining({
        brand: expect.objectContaining({
          id: 'brand-1',
          logoFileId: 'file-1',
          logoFile: expect.objectContaining({
            id: 'file-1',
            mimeType: 'image/png',
          }),
        }),
      }),
    );
  });
});

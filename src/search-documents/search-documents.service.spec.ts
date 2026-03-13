/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { SearchDocumentsService } from './search-documents.service';

describe('SearchDocumentsService', () => {
  it('syncs a service document and refreshes the owning provider document', async () => {
    const serviceFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'service-1',
        isActive: true,
        name: 'Classic Haircut',
        description: 'A clean trim.',
        ownerUser: {
          id: 'owner-1',
          fullName: 'Demo Owner',
        },
        brand: {
          name: 'Studio Reziphay',
        },
        category: {
          name: 'Barber',
        },
        address: {
          city: 'Baku',
          country: 'Azerbaijan',
        },
      })
      .mockResolvedValueOnce(null);
    const serviceSearchDocumentUpsert = jest.fn().mockResolvedValue(undefined);
    const providerSearchDocumentUpsert = jest.fn().mockResolvedValue(undefined);
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'owner-1',
      fullName: 'Demo Owner',
      status: 'ACTIVE',
      roles: [{ id: 'role-1' }],
      services: [],
      ownedBrands: [],
    });

    const service = new SearchDocumentsService({
      service: {
        findUnique: serviceFindUnique,
      },
      user: {
        findUnique: userFindUnique,
      },
      serviceSearchDocument: {
        upsert: serviceSearchDocumentUpsert,
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      providerSearchDocument: {
        upsert: providerSearchDocumentUpsert,
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
    } as any);

    await service.syncServiceDocument('service-1');

    expect(serviceSearchDocumentUpsert).toHaveBeenCalledWith({
      where: {
        serviceId: 'service-1',
      },
      update: expect.objectContaining({
        serviceName: 'Classic Haircut',
        brandName: 'Studio Reziphay',
        ownerFullName: 'Demo Owner',
        categoryName: 'Barber',
        city: 'Baku',
        country: 'Azerbaijan',
        searchText:
          'Classic Haircut A clean trim. Studio Reziphay Demo Owner Barber Baku Azerbaijan',
      }),
      create: expect.objectContaining({
        serviceId: 'service-1',
      }),
    });
    expect(providerSearchDocumentUpsert).toHaveBeenCalledWith({
      where: {
        userId: 'owner-1',
      },
      update: expect.objectContaining({
        fullName: 'Demo Owner',
        searchText: 'Demo Owner',
      }),
      create: expect.objectContaining({
        userId: 'owner-1',
      }),
    });
  });

  it('aggregates unique provider search fields from active services and owned brands', async () => {
    const providerSearchDocumentUpsert = jest.fn().mockResolvedValue(undefined);
    const service = new SearchDocumentsService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner-1',
          fullName: 'Demo Owner',
          status: 'ACTIVE',
          roles: [{ id: 'role-1' }],
          services: [
            {
              name: 'Classic Haircut',
              address: {
                city: 'Baku',
                country: 'Azerbaijan',
              },
            },
            {
              name: 'Classic Haircut',
              address: {
                city: 'Baku',
                country: 'Azerbaijan',
              },
            },
            {
              name: 'Beard Trim',
              address: {
                city: 'Sumqayit',
                country: 'Azerbaijan',
              },
            },
          ],
          ownedBrands: [
            {
              name: 'Studio Reziphay',
              addresses: [
                {
                  city: 'Baku',
                  country: 'Azerbaijan',
                },
              ],
            },
          ],
        }),
      },
      providerSearchDocument: {
        upsert: providerSearchDocumentUpsert,
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
    } as any);

    await service.syncProviderDocument('owner-1');

    expect(providerSearchDocumentUpsert).toHaveBeenCalledWith({
      where: {
        userId: 'owner-1',
      },
      update: {
        fullName: 'Demo Owner',
        serviceNames: 'Classic Haircut Beard Trim',
        brandNames: 'Studio Reziphay',
        cityNames: 'Baku Sumqayit',
        countryNames: 'Azerbaijan',
        searchText:
          'Demo Owner Classic Haircut Beard Trim Studio Reziphay Baku Sumqayit Azerbaijan',
      },
      create: expect.objectContaining({
        userId: 'owner-1',
      }),
    });
  });
});

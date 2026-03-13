/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ReservationStatus } from '@prisma/client';

import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  it('creates a review for a completed reservation and refreshes rating stats', async () => {
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'customer-1',
      role: 'UCR',
    });
    const reservationFindUnique = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.COMPLETED,
      customerUserId: 'customer-1',
      serviceId: 'service-1',
      serviceOwnerUserId: 'owner-1',
      brandId: 'brand-1',
      service: {
        name: 'Classic Haircut',
      },
      brand: {
        id: 'brand-1',
        ownerUserId: 'brand-owner-1',
      },
    });
    const reviewFindUnique = jest.fn().mockResolvedValue(null);
    const reviewCreate = jest.fn().mockResolvedValue({
      id: 'review-1',
    });
    const reviewTargetCreateMany = jest.fn().mockResolvedValue(undefined);
    const reviewAggregate = jest.fn().mockResolvedValue({
      _avg: {
        rating: 5,
      },
      _count: {
        id: 1,
      },
    });
    const serviceRatingStatUpsert = jest.fn().mockResolvedValue(undefined);
    const serviceOwnerRatingStatUpsert = jest.fn().mockResolvedValue(undefined);
    const brandRatingStatUpsert = jest.fn().mockResolvedValue(undefined);
    const reviewFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'review-1',
      reservationId: 'reservation-1',
      rating: 5,
      comment: 'Perfect experience',
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      authorUser: {
        id: 'customer-1',
        fullName: 'Demo Customer',
      },
      service: {
        id: 'service-1',
        name: 'Classic Haircut',
      },
      serviceOwnerUser: {
        id: 'owner-1',
        fullName: 'Demo Owner',
      },
      brand: {
        id: 'brand-1',
        name: 'Studio Reziphay',
      },
      targets: [],
      replies: [],
    });
    const notifyReviewReceived = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      reservation: {
        findUnique: reservationFindUnique,
      },
      review: {
        findUnique: reviewFindUnique,
      },
      $transaction: jest.fn(
        (callback: (tx: Record<string, unknown>) => unknown) =>
          Promise.resolve(
            callback({
              review: {
                create: reviewCreate,
                aggregate: reviewAggregate,
                findUniqueOrThrow: reviewFindUniqueOrThrow,
              },
              reviewTarget: {
                createMany: reviewTargetCreateMany,
              },
              serviceRatingStat: {
                upsert: serviceRatingStatUpsert,
              },
              serviceOwnerRatingStat: {
                upsert: serviceOwnerRatingStatUpsert,
              },
              brandRatingStat: {
                upsert: brandRatingStatUpsert,
              },
            }),
          ),
      ),
    } as any;

    const service = new ReviewsService(prisma, {
      notifyReviewReceived,
    } as any);

    const result = await service.createReview('customer-1', {
      reservationId: 'reservation-1',
      rating: 5,
      comment: 'Perfect experience',
    });

    expect(reviewCreate).toHaveBeenCalledWith({
      data: {
        reservationId: 'reservation-1',
        authorUserId: 'customer-1',
        serviceId: 'service-1',
        serviceOwnerUserId: 'owner-1',
        brandId: 'brand-1',
        rating: 5,
        comment: 'Perfect experience',
      },
    });
    expect(serviceRatingStatUpsert).toHaveBeenCalled();
    expect(serviceOwnerRatingStatUpsert).toHaveBeenCalled();
    expect(brandRatingStatUpsert).toHaveBeenCalled();
    expect(notifyReviewReceived).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        review: expect.objectContaining({
          id: 'review-1',
          rating: 5,
        }),
      }),
    );
  });

  it('does not allow reviews for incomplete reservations', async () => {
    const userRoleFindUnique = jest.fn().mockResolvedValue({
      userId: 'customer-1',
      role: 'UCR',
    });
    const reservationFindUnique = jest.fn().mockResolvedValue({
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      customerUserId: 'customer-1',
      serviceId: 'service-1',
      serviceOwnerUserId: 'owner-1',
      brandId: null,
      service: {
        name: 'Classic Haircut',
      },
      brand: null,
    });

    const prisma = {
      userRole: {
        findUnique: userRoleFindUnique,
      },
      reservation: {
        findUnique: reservationFindUnique,
      },
    } as any;

    const service = new ReviewsService(prisma, {} as any);

    await expect(
      service.createReview('customer-1', {
        reservationId: 'reservation-1',
        rating: 5,
        comment: 'Perfect experience',
      }),
    ).rejects.toThrow('Reviews are only allowed for completed reservations.');
  });
});

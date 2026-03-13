import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';

type ReservationPopularityTransitionInput = {
  serviceId: string;
  serviceOwnerUserId: string;
  brandId: string | null;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
};

const POPULARITY_ELIGIBLE_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
]);

@Injectable()
export class ReservationPopularityStatsService {
  async syncReservationTransition(
    tx: Prisma.TransactionClient,
    input: ReservationPopularityTransitionInput,
  ): Promise<void> {
    const delta = this.calculatePopularityDelta(
      input.fromStatus,
      input.toStatus,
    );

    if (delta === 0) {
      return;
    }

    await Promise.all([
      this.adjustServicePopularity(tx, input.serviceId, delta),
      this.adjustServiceOwnerPopularity(tx, input.serviceOwnerUserId, delta),
      input.brandId
        ? this.adjustBrandPopularity(tx, input.brandId, delta)
        : Promise.resolve(),
    ]);
  }

  private calculatePopularityDelta(
    fromStatus: ReservationStatus | null,
    toStatus: ReservationStatus,
  ): number {
    const wasCounted =
      fromStatus !== null && POPULARITY_ELIGIBLE_STATUSES.has(fromStatus);
    const isCounted = POPULARITY_ELIGIBLE_STATUSES.has(toStatus);

    if (wasCounted === isCounted) {
      return 0;
    }

    return isCounted ? 1 : -1;
  }

  private async adjustServicePopularity(
    tx: Prisma.TransactionClient,
    serviceId: string,
    delta: number,
  ): Promise<void> {
    const current = await tx.servicePopularityStat.findUnique({
      where: {
        serviceId,
      },
      select: {
        popularityScore: true,
      },
    });

    if (!current) {
      if (delta <= 0) {
        return;
      }

      await tx.servicePopularityStat.create({
        data: {
          serviceId,
          popularityScore: delta,
        },
      });

      return;
    }

    await tx.servicePopularityStat.update({
      where: {
        serviceId,
      },
      data: {
        popularityScore: Math.max(current.popularityScore + delta, 0),
      },
    });
  }

  private async adjustServiceOwnerPopularity(
    tx: Prisma.TransactionClient,
    userId: string,
    delta: number,
  ): Promise<void> {
    const current = await tx.serviceOwnerPopularityStat.findUnique({
      where: {
        userId,
      },
      select: {
        popularityScore: true,
      },
    });

    if (!current) {
      if (delta <= 0) {
        return;
      }

      await tx.serviceOwnerPopularityStat.create({
        data: {
          userId,
          popularityScore: delta,
        },
      });

      return;
    }

    await tx.serviceOwnerPopularityStat.update({
      where: {
        userId,
      },
      data: {
        popularityScore: Math.max(current.popularityScore + delta, 0),
      },
    });
  }

  private async adjustBrandPopularity(
    tx: Prisma.TransactionClient,
    brandId: string,
    delta: number,
  ): Promise<void> {
    const current = await tx.brandPopularityStat.findUnique({
      where: {
        brandId,
      },
      select: {
        popularityScore: true,
      },
    });

    if (!current) {
      if (delta <= 0) {
        return;
      }

      await tx.brandPopularityStat.create({
        data: {
          brandId,
          popularityScore: delta,
        },
      });

      return;
    }

    await tx.brandPopularityStat.update({
      where: {
        brandId,
      },
      data: {
        popularityScore: Math.max(current.popularityScore + delta, 0),
      },
    });
  }
}

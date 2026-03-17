import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // ── Brands ──────────────────────────────────────────────────────────────────

  async getFavoriteBrands(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.favoriteBrand.findMany({
      where: { userId },
      include: {
        brand: {
          include: { logoFile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((row) => ({
      id: row.brand.id,
      name: row.brand.name,
      logoFile: row.brand.logoFile
        ? this.storageService.serializeFile(row.brand.logoFile)
        : null,
    }));

    return { items };
  }

  async addFavoriteBrand(
    userId: string,
    brandId: string,
  ): Promise<Record<string, unknown>> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    await this.prisma.favoriteBrand.upsert({
      where: { userId_brandId: { userId, brandId } },
      update: {},
      create: { userId, brandId },
    });

    return { success: true };
  }

  async removeFavoriteBrand(
    userId: string,
    brandId: string,
  ): Promise<Record<string, unknown>> {
    await this.prisma.favoriteBrand.deleteMany({
      where: { userId, brandId },
    });
    return { success: true };
  }

  async checkFavoriteBrand(
    userId: string,
    brandId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.favoriteBrand.findUnique({
      where: { userId_brandId: { userId, brandId } },
    });
    return { isFavorite: row !== null };
  }

  // ── Owners ──────────────────────────────────────────────────────────────────

  async getFavoriteOwners(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.favoriteOwner.findMany({
      where: { userId },
      include: {
        owner: {
          include: { avatarFile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((row) => {
      const avatarSerialized = row.owner.avatarFile
        ? this.storageService.serializeFile(row.owner.avatarFile)
        : null;
      return {
        id: row.owner.id,
        fullName: row.owner.fullName,
        avatarUrl: avatarSerialized?.['url'] ?? null,
      };
    });

    return { items };
  }

  async addFavoriteOwner(
    userId: string,
    ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
    });
    if (!owner) throw new NotFoundException('Provider not found');

    await this.prisma.favoriteOwner.upsert({
      where: { userId_ownerUserId: { userId, ownerUserId } },
      update: {},
      create: { userId, ownerUserId },
    });

    return { success: true };
  }

  async removeFavoriteOwner(
    userId: string,
    ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    await this.prisma.favoriteOwner.deleteMany({
      where: { userId, ownerUserId },
    });
    return { success: true };
  }

  async checkFavoriteOwner(
    userId: string,
    ownerUserId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.favoriteOwner.findUnique({
      where: { userId_ownerUserId: { userId, ownerUserId } },
    });
    return { isFavorite: row !== null };
  }

  // ── Services ─────────────────────────────────────────────────────────────────

  async getFavoriteServices(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.favoriteService.findMany({
      where: { userId },
      include: {
        service: {
          include: {
            photos: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
              include: { file: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((row) => {
      const s = row.service;
      const photos = s.photos.map((p) => ({
        file: this.storageService.serializeFile(p.file),
      }));
      return {
        id: s.id,
        name: s.name,
        photos,
        priceAmount: s.priceAmount,
        priceCurrency: s.priceCurrency,
      };
    });

    return { items };
  }

  async addFavoriteService(
    userId: string,
    serviceId: string,
  ): Promise<Record<string, unknown>> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.favoriteService.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      update: {},
      create: { userId, serviceId },
    });

    return { success: true };
  }

  async removeFavoriteService(
    userId: string,
    serviceId: string,
  ): Promise<Record<string, unknown>> {
    await this.prisma.favoriteService.deleteMany({
      where: { userId, serviceId },
    });
    return { success: true };
  }

  async checkFavoriteService(
    userId: string,
    serviceId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.favoriteService.findUnique({
      where: { userId_serviceId: { userId, serviceId } },
    });
    return { isFavorite: row !== null };
  }
}

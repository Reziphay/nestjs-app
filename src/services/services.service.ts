import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  BrandStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';

import { BrandsService } from '../brands/brands.service';
import { isValidTimeRange } from '../common/utils/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDocumentsService } from '../search-documents/search-documents.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateServiceDto,
  UpdateServiceAddressDto,
  UpdateServiceDto,
} from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { serializeActiveVisibilityLabels } from '../common/utils/visibility.util';
import {
  ReplaceServiceAvailabilityExceptionsDto,
  ReplaceServiceManualBlocksDto,
  ReplaceServiceAvailabilityRulesDto,
  ServiceAvailabilityExceptionDto,
  ServiceManualBlockDto,
  ServiceAvailabilityRuleDto,
} from './dto/service-availability.dto';
import { doReservationWindowsConflict } from '../reservations/reservation-time.util';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandsService: BrandsService,
    private readonly storageService: StorageService,
    private readonly searchDocumentsService: SearchDocumentsService,
  ) {}

  async listServices(query: ListServicesDto): Promise<Record<string, unknown>> {
    const services = await this.prisma.service.findMany({
      where: {
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.q
          ? {
              name: {
                contains: query.q,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      },
      include: this.serviceInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: services.map((service) => this.serializeService(service)),
    };
  }

  async createService(
    userId: string,
    dto: CreateServiceDto,
  ): Promise<Record<string, unknown>> {
    await this.assertUso(userId);
    await this.assertServiceReferences(
      userId,
      dto.brandId,
      dto.categoryId,
      dto.addressId,
    );
    this.validatePricing(dto.priceAmount, dto.priceCurrency);
    this.validateAdvanceMinutes(dto.minAdvanceMinutes, dto.maxAdvanceMinutes);
    this.validateAvailabilityRules(dto.availabilityRules ?? []);
    this.validateAvailabilityExceptions(dto.availabilityExceptions ?? []);

    const service = await this.prisma.$transaction(async (tx) => {
      const createdAddressId = dto.address
        ? await this.createServiceAddress(tx, userId, dto.brandId, dto.address)
        : (dto.addressId ?? null);

      const createdService = await tx.service.create({
        data: {
          ownerUserId: userId,
          brandId: dto.brandId ?? null,
          categoryId: dto.categoryId ?? null,
          addressId: createdAddressId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          priceAmount: dto.priceAmount ?? null,
          priceCurrency: dto.priceCurrency?.trim().toUpperCase() || null,
          waitingTimeMinutes: dto.waitingTimeMinutes,
          minAdvanceMinutes: dto.minAdvanceMinutes ?? null,
          maxAdvanceMinutes: dto.maxAdvanceMinutes ?? null,
          serviceType: dto.serviceType,
          approvalMode: dto.approvalMode,
          freeCancellationDeadlineMinutes:
            dto.freeCancellationDeadlineMinutes ?? null,
        },
      });

      if (dto.availabilityRules && dto.availabilityRules.length > 0) {
        await tx.serviceAvailabilityRule.createMany({
          data: dto.availabilityRules.map((rule) => ({
            serviceId: createdService.id,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isActive: rule.isActive ?? true,
          })),
        });
      }

      if (dto.availabilityExceptions && dto.availabilityExceptions.length > 0) {
        await tx.serviceAvailabilityException.createMany({
          data: dto.availabilityExceptions.map((exception) => ({
            serviceId: createdService.id,
            date: new Date(exception.date),
            startTime: exception.startTime ?? null,
            endTime: exception.endTime ?? null,
            isClosedAllDay: exception.isClosedAllDay ?? false,
            note: exception.note?.trim() || null,
          })),
        });
      }

      await this.searchDocumentsService.syncServiceDocument(
        createdService.id,
        tx,
      );

      return tx.service.findUniqueOrThrow({
        where: {
          id: createdService.id,
        },
        include: this.serviceInclude,
      });
    });

    return {
      service: this.serializeService(service),
    };
  }

  async getService(serviceId: string): Promise<Record<string, unknown>> {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      include: this.serviceInclude,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    return {
      service: this.serializeService(service),
    };
  }

  async updateService(
    userId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    await this.assertServiceReferences(
      userId,
      dto.brandId === undefined ? service.brandId : (dto.brandId ?? undefined),
      dto.categoryId === undefined
        ? service.categoryId
        : (dto.categoryId ?? undefined),
      dto.addressId === undefined
        ? service.addressId
        : (dto.addressId ?? undefined),
    );
    this.validatePricing(dto.priceAmount, dto.priceCurrency);
    this.validateAdvanceMinutes(dto.minAdvanceMinutes, dto.maxAdvanceMinutes);

    if (dto.availabilityRules !== undefined) {
      this.validateAvailabilityRules(dto.availabilityRules);
    }

    const updatedService = await this.prisma.$transaction(async (tx) => {
      let addressId =
        dto.addressId === undefined ? service.addressId : dto.addressId;

      if (dto.address) {
        addressId = await this.upsertServiceAddress(
          tx,
          service.addressId,
          userId,
          dto.brandId === undefined ? service.brandId : (dto.brandId ?? null),
          dto.address,
        );
      }

      // Replace availability rules if provided
      if (dto.availabilityRules !== undefined) {
        await tx.serviceAvailabilityRule.deleteMany({
          where: { serviceId: service.id },
        });
        if (dto.availabilityRules.length > 0) {
          await tx.serviceAvailabilityRule.createMany({
            data: dto.availabilityRules.map((rule) => ({
              serviceId: service.id,
              dayOfWeek: rule.dayOfWeek,
              startTime: rule.startTime,
              endTime: rule.endTime,
              isActive: rule.isActive ?? true,
            })),
          });
        }
      }

      await tx.service.update({
        where: {
          id: service.id,
        },
        data: {
          ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.addressId !== undefined || dto.address ? { addressId } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.priceAmount !== undefined
            ? { priceAmount: dto.priceAmount }
            : {}),
          ...(dto.priceCurrency !== undefined
            ? { priceCurrency: dto.priceCurrency?.trim().toUpperCase() || null }
            : {}),
          ...(dto.waitingTimeMinutes !== undefined
            ? { waitingTimeMinutes: dto.waitingTimeMinutes }
            : {}),
          ...(dto.minAdvanceMinutes !== undefined
            ? { minAdvanceMinutes: dto.minAdvanceMinutes }
            : {}),
          ...(dto.maxAdvanceMinutes !== undefined
            ? { maxAdvanceMinutes: dto.maxAdvanceMinutes }
            : {}),
          ...(dto.serviceType !== undefined
            ? { serviceType: dto.serviceType }
            : {}),
          ...(dto.approvalMode !== undefined
            ? { approvalMode: dto.approvalMode }
            : {}),
          ...(dto.freeCancellationDeadlineMinutes !== undefined
            ? {
                freeCancellationDeadlineMinutes:
                  dto.freeCancellationDeadlineMinutes,
              }
            : {}),
        },
      });

      await this.searchDocumentsService.syncServiceDocument(service.id, tx);

      return tx.service.findUniqueOrThrow({
        where: {
          id: service.id,
        },
        include: this.serviceInclude,
      });
    });

    return {
      service: this.serializeService(updatedService),
    };
  }

  async archiveService(
    userId: string,
    serviceId: string,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    const activeReservationCount = await this.prisma.reservation.count({
      where: {
        serviceId: service.id,
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER,
            ReservationStatus.CHANGE_REQUESTED_BY_OWNER,
          ],
        },
      },
    });

    if (activeReservationCount > 0) {
      throw new BadRequestException(
        'Services with active reservations cannot be archived.',
      );
    }

    const archivedService = await this.prisma.service.update({
      where: {
        id: service.id,
      },
      data: {
        isActive: false,
      },
      include: this.serviceInclude,
    });

    await this.searchDocumentsService.syncServiceDocument(service.id);

    return {
      service: this.serializeService(archivedService),
    };
  }

  async replaceAvailabilityRules(
    userId: string,
    serviceId: string,
    dto: ReplaceServiceAvailabilityRulesDto,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    this.validateAvailabilityRules(dto.rules);

    await this.prisma.$transaction([
      this.prisma.serviceAvailabilityRule.deleteMany({
        where: {
          serviceId: service.id,
        },
      }),
      ...(dto.rules.length > 0
        ? [
            this.prisma.serviceAvailabilityRule.createMany({
              data: dto.rules.map((rule) => ({
                serviceId: service.id,
                dayOfWeek: rule.dayOfWeek,
                startTime: rule.startTime,
                endTime: rule.endTime,
                isActive: rule.isActive ?? true,
              })),
            }),
          ]
        : []),
    ]);

    return this.getAvailability(service.id);
  }

  async replaceAvailabilityExceptions(
    userId: string,
    serviceId: string,
    dto: ReplaceServiceAvailabilityExceptionsDto,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    this.validateAvailabilityExceptions(dto.exceptions);

    await this.prisma.$transaction([
      this.prisma.serviceAvailabilityException.deleteMany({
        where: {
          serviceId: service.id,
        },
      }),
      ...(dto.exceptions.length > 0
        ? [
            this.prisma.serviceAvailabilityException.createMany({
              data: dto.exceptions.map((exception) => ({
                serviceId: service.id,
                date: new Date(exception.date),
                startTime: exception.startTime ?? null,
                endTime: exception.endTime ?? null,
                isClosedAllDay: exception.isClosedAllDay ?? false,
                note: exception.note?.trim() || null,
              })),
            }),
          ]
        : []),
    ]);

    return this.getAvailability(service.id);
  }

  async replaceManualBlocks(
    userId: string,
    serviceId: string,
    dto: ReplaceServiceManualBlocksDto,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    this.validateManualBlocks(dto.blocks);

    await this.prisma.$transaction([
      this.prisma.serviceManualBlock.deleteMany({
        where: {
          serviceId: service.id,
        },
      }),
      ...(dto.blocks.length > 0
        ? [
            this.prisma.serviceManualBlock.createMany({
              data: dto.blocks.map((block) => ({
                serviceId: service.id,
                startsAt: new Date(block.startsAt),
                endsAt: new Date(block.endsAt),
                reason: block.reason?.trim() || null,
              })),
            }),
          ]
        : []),
    ]);

    return this.getAvailability(service.id);
  }

  async getAvailability(serviceId: string): Promise<Record<string, unknown>> {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      select: {
        id: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const [rules, exceptions, manualBlocks] = await Promise.all([
      this.prisma.serviceAvailabilityRule.findMany({
        where: {
          serviceId,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.serviceAvailabilityException.findMany({
        where: {
          serviceId,
        },
        orderBy: {
          date: 'asc',
        },
      }),
      this.prisma.serviceManualBlock.findMany({
        where: {
          serviceId,
        },
        orderBy: {
          startsAt: 'asc',
        },
      }),
    ]);

    return {
      rules,
      exceptions,
      manualBlocks,
    };
  }

  async addPhoto(
    userId: string,
    serviceId: string,
    file: Express.Multer.File | undefined,
  ): Promise<Record<string, unknown>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);
    const uploadedFile = await this.storageService.uploadFile(
      file,
      userId,
      'service-photos',
    );
    const currentPhotoCount = await this.prisma.servicePhoto.count({
      where: {
        serviceId: service.id,
      },
    });

    const photo = await this.prisma.servicePhoto.create({
      data: {
        serviceId: service.id,
        fileId: uploadedFile.id,
        sortOrder: currentPhotoCount,
      },
      include: {
        file: true,
      },
    });

    return {
      photo,
    };
  }

  async deletePhoto(
    userId: string,
    serviceId: string,
    photoId: string,
  ): Promise<Record<string, boolean>> {
    const service = await this.getOwnedServiceOrThrow(userId, serviceId);

    const photo = await this.prisma.servicePhoto.findFirst({
      where: {
        id: photoId,
        serviceId: service.id,
      },
    });

    if (!photo) {
      throw new NotFoundException('Service photo not found.');
    }

    await this.prisma.servicePhoto.delete({
      where: {
        id: photo.id,
      },
    });

    return {
      deleted: true,
    };
  }

  private async assertUso(userId: string): Promise<void> {
    const usoRole = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role: AppRole.USO,
        },
      },
    });

    if (!usoRole) {
      throw new ForbiddenException('A USO role is required for this action.');
    }
  }

  private async assertServiceReferences(
    userId: string,
    brandId?: string | null,
    categoryId?: string | null,
    addressId?: string | null,
  ): Promise<void> {
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: {
          id: brandId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!brand || brand.status !== BrandStatus.ACTIVE) {
        throw new NotFoundException('Active brand not found.');
      }

      await this.brandsService.assertActiveMembership(brandId, userId);
    }

    if (categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!category || !category.isActive) {
        throw new NotFoundException('Active service category not found.');
      }
    }

    if (addressId) {
      const address = await this.prisma.serviceAddress.findUnique({
        where: {
          id: addressId,
        },
      });

      if (!address) {
        throw new NotFoundException('Service address not found.');
      }

      if (address.ownerUserId && address.ownerUserId !== userId) {
        throw new ForbiddenException(
          'You can only attach service addresses you control.',
        );
      }
    }
  }

  private async getOwnedServiceOrThrow(userId: string, serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    if (service.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the service owner can perform this action.',
      );
    }

    return service;
  }

  private validatePricing(
    priceAmount: number | null | undefined,
    priceCurrency: string | null | undefined,
  ): void {
    if ((priceAmount ?? null) === null && !priceCurrency) {
      return;
    }

    if ((priceAmount ?? null) === null || !priceCurrency) {
      throw new BadRequestException(
        'priceAmount and priceCurrency must be provided together.',
      );
    }
  }

  private validateAdvanceMinutes(
    minAdvanceMinutes: number | null | undefined,
    maxAdvanceMinutes: number | null | undefined,
  ): void {
    if (
      minAdvanceMinutes !== undefined &&
      maxAdvanceMinutes !== undefined &&
      minAdvanceMinutes !== null &&
      maxAdvanceMinutes !== null &&
      maxAdvanceMinutes < minAdvanceMinutes
    ) {
      throw new BadRequestException(
        'maxAdvanceMinutes must be greater than or equal to minAdvanceMinutes.',
      );
    }
  }

  private validateAvailabilityRules(rules: ServiceAvailabilityRuleDto[]): void {
    for (const rule of rules) {
      if (!isValidTimeRange(rule.startTime, rule.endTime)) {
        throw new BadRequestException(
          `Invalid availability rule time range for ${rule.dayOfWeek}.`,
        );
      }
    }
  }

  private validateAvailabilityExceptions(
    exceptions: ServiceAvailabilityExceptionDto[],
  ): void {
    for (const exception of exceptions) {
      const isClosedAllDay = exception.isClosedAllDay ?? false;

      if (isClosedAllDay) {
        continue;
      }

      if (!exception.startTime || !exception.endTime) {
        throw new BadRequestException(
          'Availability exceptions must include startTime and endTime unless closed all day.',
        );
      }

      if (!isValidTimeRange(exception.startTime, exception.endTime)) {
        throw new BadRequestException(
          `Invalid availability exception time range on ${exception.date}.`,
        );
      }
    }
  }

  private validateManualBlocks(blocks: ServiceManualBlockDto[]): void {
    const parsedBlocks = blocks.map((block) => {
      const startsAt = new Date(block.startsAt);
      const endsAt = new Date(block.endsAt);

      if (
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(endsAt.getTime()) ||
        endsAt.getTime() <= startsAt.getTime()
      ) {
        throw new BadRequestException(
          'Manual blocks must have a valid end time after the start time.',
        );
      }

      return {
        startsAt,
        endsAt,
      };
    });

    parsedBlocks.sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
    );

    for (let index = 1; index < parsedBlocks.length; index += 1) {
      const previousBlock = parsedBlocks[index - 1];
      const currentBlock = parsedBlocks[index];

      if (
        doReservationWindowsConflict(
          currentBlock.startsAt,
          currentBlock.endsAt,
          previousBlock.startsAt,
          previousBlock.endsAt,
        )
      ) {
        throw new BadRequestException(
          'Manual blocks must not overlap each other.',
        );
      }
    }
  }

  private async createServiceAddress(
    tx: Prisma.TransactionClient,
    userId: string,
    brandId: string | undefined,
    dto: {
      label?: string;
      fullAddress: string;
      country: string;
      city: string;
      lat?: number;
      lng?: number;
      placeId?: string;
    },
  ): Promise<string> {
    const address = await tx.serviceAddress.create({
      data: {
        brandId: brandId ?? null,
        ownerUserId: userId,
        label: dto.label?.trim() || null,
        fullAddress: dto.fullAddress.trim(),
        country: dto.country.trim(),
        city: dto.city.trim(),
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        placeId: dto.placeId?.trim() || null,
      },
    });

    return address.id;
  }

  private async upsertServiceAddress(
    tx: Prisma.TransactionClient,
    addressId: string | null,
    userId: string,
    brandId: string | null,
    dto: UpdateServiceAddressDto,
  ): Promise<string> {
    if (!addressId) {
      if (!dto.fullAddress || !dto.country || !dto.city) {
        throw new BadRequestException(
          'A new service address requires fullAddress, country, and city.',
        );
      }

      return this.createServiceAddress(tx, userId, brandId ?? undefined, {
        fullAddress: dto.fullAddress,
        country: dto.country,
        city: dto.city,
        label: dto.label,
        lat: dto.lat,
        lng: dto.lng,
        placeId: dto.placeId,
      });
    }

    await tx.serviceAddress.update({
      where: {
        id: addressId,
      },
      data: {
        ...(dto.label !== undefined
          ? { label: dto.label?.trim() || null }
          : {}),
        ...(dto.fullAddress !== undefined
          ? { fullAddress: dto.fullAddress.trim() }
          : {}),
        ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.placeId !== undefined
          ? { placeId: dto.placeId?.trim() || null }
          : {}),
        brandId,
        ownerUserId: userId,
      },
    });

    return addressId;
  }

  private serializeService(
    service: Prisma.ServiceGetPayload<{
      include: typeof ServicesService.prototype.serviceInclude;
    }>,
  ): Record<string, unknown> {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      owner: {
        ...service.ownerUser,
        ratingStats: service.ownerUser.serviceOwnerRatingStat ?? {
          avgRating: 0,
          reviewCount: 0,
        },
      },
      brand: service.brand
        ? {
            ...service.brand,
            ratingStats: service.brand.brandRatingStat ?? {
              avgRating: 0,
              reviewCount: 0,
            },
          }
        : null,
      category: service.category,
      address: service.address,
      priceAmount: service.priceAmount,
      priceCurrency: service.priceCurrency,
      waitingTimeMinutes: service.waitingTimeMinutes,
      minAdvanceMinutes: service.minAdvanceMinutes,
      maxAdvanceMinutes: service.maxAdvanceMinutes,
      serviceType: service.serviceType,
      approvalMode: service.approvalMode,
      freeCancellationDeadlineMinutes: service.freeCancellationDeadlineMinutes,
      isActive: service.isActive,
      ratingStats: service.ratingStat ?? {
        avgRating: 0,
        reviewCount: 0,
      },
      visibilityLabels: serializeActiveVisibilityLabels(
        service.visibilityAssignments,
      ),
      photos: service.photos.map((photo) => ({
        id: photo.id,
        sortOrder: photo.sortOrder,
        file: this.storageService.serializeFile(photo.file),
      })),
      availability: {
        rules: service.availabilityRules,
        exceptions: service.availabilityExceptions,
        manualBlocks: service.manualBlocks,
      },
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private get serviceInclude() {
    return {
      ownerUser: {
        select: {
          id: true,
          fullName: true,
          serviceOwnerRatingStat: {
            select: {
              avgRating: true,
              reviewCount: true,
            },
          },
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
          status: true,
          brandRatingStat: {
            select: {
              avgRating: true,
              reviewCount: true,
            },
          },
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      address: true,
      ratingStat: {
        select: {
          avgRating: true,
          reviewCount: true,
        },
      },
      visibilityAssignments: {
        where: {
          label: {
            isActive: true,
          },
        },
        include: {
          label: {
            select: {
              id: true,
              name: true,
              slug: true,
              targetType: true,
              priority: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc' as const,
        },
      },
      photos: {
        include: {
          file: true,
        },
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
      availabilityRules: {
        orderBy: [
          {
            dayOfWeek: 'asc' as const,
          },
          {
            startTime: 'asc' as const,
          },
        ],
      },
      availabilityExceptions: {
        orderBy: {
          date: 'asc' as const,
        },
      },
      manualBlocks: {
        orderBy: {
          startsAt: 'asc' as const,
        },
      },
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  BrandJoinRequestStatus,
  BrandMembershipRole,
  BrandMembershipStatus,
  BrandStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBrandJoinRequestDto,
  TransferBrandOwnershipDto,
} from './dto/brand-actions.dto';
import {
  CreateBrandDto,
  UpdateBrandAddressDto,
  UpdateBrandDto,
} from './dto/create-brand.dto';
import { ListBrandsDto } from './dto/list-brands.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBrands(query: ListBrandsDto): Promise<Record<string, unknown>> {
    const brands = await this.prisma.brand.findMany({
      where: {
        status: BrandStatus.ACTIVE,
        ...(query.q
          ? {
              name: {
                contains: query.q,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
          },
        },
        addresses: {
          where: {
            isPrimary: true,
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: brands.map((brand) => this.serializeBrand(brand)),
    };
  }

  async createBrand(
    userId: string,
    dto: CreateBrandDto,
  ): Promise<Record<string, unknown>> {
    await this.assertUso(userId);
    await this.assertLogoOwnership(dto.logoFileId, userId);

    const brand = await this.prisma.$transaction(async (tx) => {
      const createdBrand = await tx.brand.create({
        data: {
          ownerUserId: userId,
          logoFileId: dto.logoFileId ?? null,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
        },
      });

      await tx.brandAddress.create({
        data: {
          brandId: createdBrand.id,
          label: dto.primaryAddress.label?.trim() || null,
          fullAddress: dto.primaryAddress.fullAddress.trim(),
          country: dto.primaryAddress.country.trim(),
          city: dto.primaryAddress.city.trim(),
          lat: dto.primaryAddress.lat ?? null,
          lng: dto.primaryAddress.lng ?? null,
          placeId: dto.primaryAddress.placeId?.trim() || null,
          isPrimary: true,
        },
      });

      await tx.brandMembership.create({
        data: {
          brandId: createdBrand.id,
          userId,
          membershipRole: BrandMembershipRole.OWNER,
          status: BrandMembershipStatus.ACTIVE,
        },
      });

      return tx.brand.findUniqueOrThrow({
        where: {
          id: createdBrand.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
            },
          },
          addresses: {
            where: {
              isPrimary: true,
            },
            take: 1,
          },
          memberships: {
            where: {
              status: BrandMembershipStatus.ACTIVE,
            },
          },
        },
      });
    });

    return {
      brand: this.serializeBrand(brand),
    };
  }

  async getBrand(brandId: string): Promise<Record<string, unknown>> {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
          },
        },
        addresses: {
          where: {
            isPrimary: true,
          },
          take: 1,
        },
        memberships: {
          where: {
            status: BrandMembershipStatus.ACTIVE,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    return {
      brand: this.serializeBrand(brand),
    };
  }

  async updateBrand(
    userId: string,
    brandId: string,
    dto: UpdateBrandDto,
  ): Promise<Record<string, unknown>> {
    const brand = await this.getOwnedBrandOrThrow(userId, brandId);
    await this.assertLogoOwnership(dto.logoFileId, userId);

    const updatedBrand = await this.prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: {
          id: brand.id,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.logoFileId !== undefined
            ? { logoFileId: dto.logoFileId }
            : {}),
        },
      });

      if (dto.primaryAddress) {
        await this.upsertPrimaryAddress(tx, brand.id, dto.primaryAddress);
      }

      return tx.brand.findUniqueOrThrow({
        where: {
          id: brand.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
            },
          },
          addresses: {
            where: {
              isPrimary: true,
            },
            take: 1,
          },
          memberships: {
            where: {
              status: BrandMembershipStatus.ACTIVE,
            },
          },
        },
      });
    });

    return {
      brand: this.serializeBrand(updatedBrand),
    };
  }

  async createJoinRequest(
    userId: string,
    brandId: string,
    dto: CreateBrandJoinRequestDto,
  ): Promise<Record<string, unknown>> {
    await this.assertUso(userId);
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    if (brand.ownerUserId === userId) {
      throw new ConflictException(
        'The brand owner cannot create a join request.',
      );
    }

    const [membership, pendingRequest] = await Promise.all([
      this.prisma.brandMembership.findUnique({
        where: {
          brandId_userId: {
            brandId,
            userId,
          },
        },
      }),
      this.prisma.brandJoinRequest.findFirst({
        where: {
          brandId,
          requesterUserId: userId,
          status: BrandJoinRequestStatus.PENDING,
        },
      }),
    ]);

    if (membership?.status === BrandMembershipStatus.ACTIVE) {
      throw new ConflictException(
        'You are already an active member of this brand.',
      );
    }

    if (pendingRequest) {
      throw new ConflictException(
        'A join request is already pending for this brand.',
      );
    }

    const joinRequest = await this.prisma.brandJoinRequest.create({
      data: {
        brandId,
        requesterUserId: userId,
        message: dto.message?.trim() || null,
      },
      include: {
        requesterUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      joinRequest,
    };
  }

  async listJoinRequests(
    userId: string,
    brandId: string,
  ): Promise<Record<string, unknown>> {
    await this.getOwnedBrandOrThrow(userId, brandId);

    const joinRequests = await this.prisma.brandJoinRequest.findMany({
      where: {
        brandId,
      },
      include: {
        requesterUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: joinRequests,
    };
  }

  async acceptJoinRequest(
    userId: string,
    brandId: string,
    requestId: string,
  ): Promise<Record<string, unknown>> {
    await this.getOwnedBrandOrThrow(userId, brandId);
    const joinRequest = await this.getPendingJoinRequestOrThrow(
      brandId,
      requestId,
    );
    await this.assertUso(joinRequest.requesterUserId);

    const acceptedJoinRequest = await this.prisma.$transaction(async (tx) => {
      await tx.brandJoinRequest.update({
        where: {
          id: joinRequest.id,
        },
        data: {
          status: BrandJoinRequestStatus.ACCEPTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.brandMembership.upsert({
        where: {
          brandId_userId: {
            brandId,
            userId: joinRequest.requesterUserId,
          },
        },
        update: {
          status: BrandMembershipStatus.ACTIVE,
          membershipRole: BrandMembershipRole.MEMBER,
        },
        create: {
          brandId,
          userId: joinRequest.requesterUserId,
          membershipRole: BrandMembershipRole.MEMBER,
          status: BrandMembershipStatus.ACTIVE,
        },
      });

      return tx.brandJoinRequest.findUniqueOrThrow({
        where: {
          id: joinRequest.id,
        },
        include: {
          requesterUser: {
            select: {
              id: true,
              fullName: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });

    return {
      joinRequest: acceptedJoinRequest,
    };
  }

  async rejectJoinRequest(
    userId: string,
    brandId: string,
    requestId: string,
  ): Promise<Record<string, unknown>> {
    await this.getOwnedBrandOrThrow(userId, brandId);
    await this.getPendingJoinRequestOrThrow(brandId, requestId);

    const rejectedJoinRequest = await this.prisma.brandJoinRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: BrandJoinRequestStatus.REJECTED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
      include: {
        requesterUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      joinRequest: rejectedJoinRequest,
    };
  }

  async transferOwnership(
    userId: string,
    brandId: string,
    dto: TransferBrandOwnershipDto,
  ): Promise<Record<string, unknown>> {
    const brand = await this.getOwnedBrandOrThrow(userId, brandId);
    await this.assertUso(dto.targetUserId);

    const transferredBrand = await this.prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: {
          id: brand.id,
        },
        data: {
          ownerUserId: dto.targetUserId,
        },
      });

      await tx.brandMembership.upsert({
        where: {
          brandId_userId: {
            brandId,
            userId: userId,
          },
        },
        update: {
          membershipRole: BrandMembershipRole.MEMBER,
          status: BrandMembershipStatus.ACTIVE,
        },
        create: {
          brandId,
          userId,
          membershipRole: BrandMembershipRole.MEMBER,
          status: BrandMembershipStatus.ACTIVE,
        },
      });

      await tx.brandMembership.upsert({
        where: {
          brandId_userId: {
            brandId,
            userId: dto.targetUserId,
          },
        },
        update: {
          membershipRole: BrandMembershipRole.OWNER,
          status: BrandMembershipStatus.ACTIVE,
        },
        create: {
          brandId,
          userId: dto.targetUserId,
          membershipRole: BrandMembershipRole.OWNER,
          status: BrandMembershipStatus.ACTIVE,
        },
      });

      return tx.brand.findUniqueOrThrow({
        where: {
          id: brand.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
            },
          },
          addresses: {
            where: {
              isPrimary: true,
            },
            take: 1,
          },
          memberships: {
            where: {
              status: BrandMembershipStatus.ACTIVE,
            },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      brand: this.serializeBrand(transferredBrand),
    };
  }

  async listMembers(brandId: string): Promise<Record<string, unknown>> {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
      select: {
        id: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    const members = await this.prisma.brandMembership.findMany({
      where: {
        brandId,
        status: BrandMembershipStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        {
          membershipRole: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return {
      items: members,
    };
  }

  async assertActiveMembership(brandId: string, userId: string): Promise<void> {
    const membership = await this.prisma.brandMembership.findUnique({
      where: {
        brandId_userId: {
          brandId,
          userId,
        },
      },
    });

    if (!membership || membership.status !== BrandMembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'You are not an active member of this brand.',
      );
    }
  }

  private async getOwnedBrandOrThrow(userId: string, brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id: brandId,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    if (brand.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the brand owner can perform this action.',
      );
    }

    return brand;
  }

  private async getPendingJoinRequestOrThrow(
    brandId: string,
    requestId: string,
  ) {
    const joinRequest = await this.prisma.brandJoinRequest.findFirst({
      where: {
        id: requestId,
        brandId,
        status: BrandJoinRequestStatus.PENDING,
      },
    });

    if (!joinRequest) {
      throw new NotFoundException('Pending brand join request not found.');
    }

    return joinRequest;
  }

  private async upsertPrimaryAddress(
    tx: Prisma.TransactionClient,
    brandId: string,
    dto: UpdateBrandAddressDto,
  ): Promise<void> {
    const existingPrimaryAddress = await tx.brandAddress.findFirst({
      where: {
        brandId,
        isPrimary: true,
      },
    });

    if (!existingPrimaryAddress) {
      if (!dto.fullAddress || !dto.country || !dto.city) {
        throw new BadRequestException(
          'A new primary address requires fullAddress, country, and city.',
        );
      }

      await tx.brandAddress.create({
        data: {
          brandId,
          label: dto.label?.trim() || null,
          fullAddress: dto.fullAddress.trim(),
          country: dto.country.trim(),
          city: dto.city.trim(),
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          placeId: dto.placeId?.trim() || null,
          isPrimary: true,
        },
      });

      return;
    }

    await tx.brandAddress.update({
      where: {
        id: existingPrimaryAddress.id,
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
      },
    });
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

  private async assertLogoOwnership(
    logoFileId: string | undefined,
    userId: string,
  ): Promise<void> {
    if (!logoFileId) {
      return;
    }

    const logoFile = await this.prisma.fileObject.findUnique({
      where: {
        id: logoFileId,
      },
    });

    if (!logoFile) {
      throw new NotFoundException('Logo file not found.');
    }

    if (logoFile.uploadedByUserId && logoFile.uploadedByUserId !== userId) {
      throw new ForbiddenException('You can only attach files you uploaded.');
    }
  }

  private serializeBrand(brand: {
    id: string;
    name: string;
    description: string | null;
    status: BrandStatus;
    logoFileId: string | null;
    owner: {
      id: string;
      fullName: string;
    };
    addresses: Array<{
      id: string;
      label: string | null;
      fullAddress: string;
      country: string;
      city: string;
      lat: number | null;
      lng: number | null;
      placeId: string | null;
      isPrimary: boolean;
    }>;
    memberships?: Array<{
      id: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    const primaryAddress =
      brand.addresses.find((address) => address.isPrimary) ?? null;

    return {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      status: brand.status,
      owner: brand.owner,
      logoFileId: brand.logoFileId,
      primaryAddress,
      memberCount: brand.memberships?.length,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}

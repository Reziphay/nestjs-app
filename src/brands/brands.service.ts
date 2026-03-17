import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AppRole,
  BrandJoinRequestStatus,
  BrandMembershipRole,
  BrandMembershipStatus,
  BrandStatus,
  Prisma,
} from '@prisma/client';
import { createHmac } from 'crypto';
import { ConfigType } from '@nestjs/config';

import { authConfig } from '../config';
import { OtpPurpose } from '../common/enums/otp-purpose.enum';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDocumentsService } from '../search-documents/search-documents.service';
import { StorageService } from '../storage/storage.service';
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
import { serializeActiveVisibilityLabels } from '../common/utils/visibility.util';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly searchDocumentsService: SearchDocumentsService,
    @Inject(authConfig.KEY)
    private readonly authConfiguration: ConfigType<typeof authConfig>,
  ) {}

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
      include: this.getBrandInclude(false),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: brands.map((brand) => this.serializeBrand(brand)),
    };
  }

  async listMyBrands(userId: string): Promise<Record<string, unknown>> {
    const brands = await this.prisma.brand.findMany({
      where: {
        status: BrandStatus.ACTIVE,
        memberships: {
          some: {
            userId,
            status: BrandMembershipStatus.ACTIVE,
          },
        },
      },
      include: this.getBrandInclude(false),
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: brands.map((brand) => this.serializeBrand(brand)),
    };
  }

  async deleteBrand(
    userId: string,
    brandId: string,
  ): Promise<void> {
    const brand = await this.getOwnedBrandOrThrow(userId, brandId);

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete: mark as closed
      await tx.brand.update({
        where: { id: brand.id },
        data: { status: BrandStatus.CLOSED },
      });
      // Remove all memberships
      await tx.brandMembership.updateMany({
        where: { brandId: brand.id },
        data: { status: BrandMembershipStatus.REMOVED },
      });
    });
  }

  async createBrand(
    userId: string,
    dto: CreateBrandDto,
  ): Promise<Record<string, unknown>> {
    await this.assertUso(userId);
    await this.assertLogoOwnership(dto.logoFileId, userId);

    // If a brand phone is provided, verify OTP before creating
    if (dto.phone && dto.phoneOtpCode) {
      await this.verifyAndConsumePhoneOtp(dto.phone, dto.phoneOtpCode);
    }

    const brand = await this.prisma.$transaction(async (tx) => {
      const createdBrand = await tx.brand.create({
        data: {
          ownerUserId: userId,
          logoFileId: dto.logoFileId ?? null,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          location: dto.location?.trim() || null,
          website: dto.website?.trim() || null,
        },
      });

      if (dto.primaryAddress) {
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
      }

      await tx.brandMembership.create({
        data: {
          brandId: createdBrand.id,
          userId,
          membershipRole: BrandMembershipRole.OWNER,
          status: BrandMembershipStatus.ACTIVE,
        },
      });

      await this.searchDocumentsService.syncBrandDocument(createdBrand.id, tx);

      return tx.brand.findUniqueOrThrow({
        where: {
          id: createdBrand.id,
        },
        include: this.getBrandInclude(true),
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
      include: this.getBrandInclude(true),
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
          ...(dto.email !== undefined
            ? { email: dto.email?.trim() || null }
            : {}),
          ...(dto.location !== undefined
            ? { location: dto.location?.trim() || null }
            : {}),
          ...(dto.website !== undefined
            ? { website: dto.website?.trim() || null }
            : {}),
          ...(dto.logoFileId !== undefined
            ? { logoFileId: dto.logoFileId }
            : {}),
        },
      });

      if (dto.primaryAddress) {
        await this.upsertPrimaryAddress(tx, brand.id, dto.primaryAddress);
      }

      await this.searchDocumentsService.syncBrandDocument(brand.id, tx);

      return tx.brand.findUniqueOrThrow({
        where: {
          id: brand.id,
        },
        include: this.getBrandInclude(true),
      });
    });

    return {
      brand: this.serializeBrand(updatedBrand),
    };
  }

  async uploadLogo(
    userId: string,
    brandId: string,
    file: Express.Multer.File | undefined,
  ): Promise<Record<string, unknown>> {
    const brand = await this.getOwnedBrandOrThrow(userId, brandId);
    const uploadedFile = await this.storageService.uploadFile(
      file,
      userId,
      'brand-logos',
    );

    const updatedBrand = await this.prisma.brand.update({
      where: {
        id: brand.id,
      },
      data: {
        logoFileId: uploadedFile.id,
      },
      include: this.getBrandInclude(true),
    });

    await this.searchDocumentsService.syncBrandDocument(brand.id);

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

      await this.searchDocumentsService.syncBrandDocument(brand.id, tx);
      await this.searchDocumentsService.syncProviderDocument(userId, tx);

      return tx.brand.findUniqueOrThrow({
        where: {
          id: brand.id,
        },
        include: this.getBrandInclude(true),
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

  private async verifyAndConsumePhoneOtp(
    phone: string,
    code: string,
  ): Promise<void> {
    // Normalize phone the same way auth service does (strip leading spaces)
    const normalizedPhone = phone.replace(/\s+/g, '');
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: OtpPurpose.VERIFY_PHONE,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Phone OTP is invalid or expired.');
    }

    const hashed = createHmac('sha256', this.authConfiguration.hashSecret)
      .update(code.trim())
      .digest('hex');

    if (hashed !== otpRecord.codeHash) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException('Phone OTP is invalid or expired.');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    });
  }

  private getBrandInclude(includeMemberships: boolean) {
    return {
      owner: {
        select: {
          id: true,
          fullName: true,
          avatarFile: true,
        },
      },
      logoFile: true,
      addresses: {
        where: {
          isPrimary: true,
        },
        take: 1,
      },
      brandRatingStat: {
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
      ...(includeMemberships
        ? {
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
          }
        : {}),
    } satisfies Prisma.BrandInclude;
  }

  private serializeBrand(brand: {
    id: string;
    name: string;
    description: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    website: string | null;
    status: BrandStatus;
    logoFileId: string | null;
    logoFile?: {
      id: string;
      bucket: string;
      objectKey: string;
      originalFilename: string | null;
      mimeType: string;
      sizeBytes: number;
      uploadedByUserId: string | null;
      createdAt: Date;
    } | null;
    owner: {
      id: string;
      fullName: string;
      avatarFile?: {
        id: string;
        bucket: string;
        objectKey: string;
        originalFilename: string | null;
        mimeType: string;
        sizeBytes: number;
        uploadedByUserId: string | null;
        createdAt: Date;
      } | null;
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
    brandRatingStat?: {
      avgRating: Prisma.Decimal;
      reviewCount: number;
    } | null;
    visibilityAssignments: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date | null;
      label: {
        id: string;
        name: string;
        slug: string;
        targetType: string;
        priority: number;
      };
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
      email: brand.email,
      phone: brand.phone,
      location: brand.location,
      website: brand.website,
      status: brand.status,
      owner: {
        id: brand.owner.id,
        fullName: brand.owner.fullName,
        avatar: brand.owner.avatarFile
          ? this.storageService.serializeFile(brand.owner.avatarFile)
          : null,
      },
      logoFileId: brand.logoFileId,
      logoFile: brand.logoFile
        ? this.storageService.serializeFile(brand.logoFile)
        : null,
      primaryAddress,
      memberCount: brand.memberships?.length,
      ratingStats: brand.brandRatingStat ?? {
        avgRating: 0,
        reviewCount: 0,
      },
      visibilityLabels: serializeActiveVisibilityLabels(
        brand.visibilityAssignments,
      ),
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}

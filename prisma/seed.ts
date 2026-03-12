import {
  AccountStatus,
  AdminRole,
  BrandMembershipRole,
  CompletionMethod,
  NotificationScreen,
  NotificationType,
  PenaltyDisputeStatus,
  PenaltyReason,
  Prisma,
  PrismaClient,
  ReservationActorType,
  ReservationPartyType,
  ReservationStatus,
  ReviewTargetType,
  ServiceMode,
  UserRole,
  VisibilityLabel,
  VisibilitySourceType,
  VisibilityTargetType,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const seedIds = {
  admin: 'seed_admin_super',
  categoryBarber: 'seed_category_barber',
  categoryDental: 'seed_category_dental',
  categoryBeauty: 'seed_category_beauty',
  categoryConsulting: 'seed_category_consulting',
  categoryRepair: 'seed_category_repair',
  userCustomer: 'seed_user_customer',
  userProvider: 'seed_user_provider',
  userHybrid: 'seed_user_hybrid',
  userApplicant: 'seed_user_applicant',
  profileCustomer: 'seed_profile_customer',
  profileProvider: 'seed_profile_provider',
  profileHybrid: 'seed_profile_hybrid',
  profileApplicant: 'seed_profile_applicant',
  settingsCustomer: 'seed_settings_customer',
  settingsProvider: 'seed_settings_provider',
  settingsHybrid: 'seed_settings_hybrid',
  settingsApplicant: 'seed_settings_applicant',
  roleCustomerCustomer: 'seed_role_customer_customer',
  roleProviderProvider: 'seed_role_provider_provider',
  roleHybridCustomer: 'seed_role_hybrid_customer',
  roleHybridProvider: 'seed_role_hybrid_provider',
  roleApplicantProvider: 'seed_role_applicant_provider',
  brandMain: 'seed_brand_main',
  memberOwner: 'seed_brand_member_owner',
  memberHybrid: 'seed_brand_member_hybrid',
  joinRequestApplicant: 'seed_brand_join_request_applicant',
  serviceMain: 'seed_service_main',
  servicePhotoCover: 'seed_service_photo_cover',
  servicePhotoGallery: 'seed_service_photo_gallery',
  availabilityMonday: 'seed_availability_monday',
  availabilityTuesday: 'seed_availability_tuesday',
  availabilitySaturday: 'seed_availability_saturday',
  breakMondayLunch: 'seed_break_monday_lunch',
  closureHoliday: 'seed_closure_holiday',
  reservationPending: 'seed_reservation_pending',
  reservationApproved: 'seed_reservation_approved',
  reservationCompleted: 'seed_reservation_completed',
  reservationNoShow: 'seed_reservation_no_show',
  historyPendingCreated: 'seed_history_pending_created',
  historyApprovedCreated: 'seed_history_approved_created',
  historyApprovedApproved: 'seed_history_approved_approved',
  historyCompletedCreated: 'seed_history_completed_created',
  historyCompletedApproved: 'seed_history_completed_approved',
  historyCompletedCompleted: 'seed_history_completed_completed',
  historyNoShowCreated: 'seed_history_no_show_created',
  historyNoShowApproved: 'seed_history_no_show_approved',
  historyNoShowMarked: 'seed_history_no_show_marked',
  changeRequestApproved: 'seed_change_request_approved',
  reviewCompleted: 'seed_review_completed',
  reviewTargetService: 'seed_review_target_service',
  reviewTargetProvider: 'seed_review_target_provider',
  reviewTargetBrand: 'seed_review_target_brand',
  reviewReplyCompleted: 'seed_review_reply_completed',
  penaltyNoShow: 'seed_penalty_no_show',
  penaltyDisputeNoShow: 'seed_penalty_dispute_no_show',
  notificationProviderPending: 'seed_notification_provider_pending',
  notificationCustomerApproved: 'seed_notification_customer_approved',
  notificationCustomerCompleted: 'seed_notification_customer_completed',
  pushDeviceCustomer: 'seed_push_device_customer',
  visibilityBrandFeatured: 'seed_visibility_brand_featured',
  visibilityServiceVip: 'seed_visibility_service_vip',
  sponsoredServiceMain: 'seed_sponsored_service_main',
  abuseReportReview: 'seed_abuse_report_review',
  auditReservationCompleted: 'seed_audit_reservation_completed',
} as const;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

async function upsertUser(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    phoneNumber: string;
    email: string;
    fullName: string;
    activeRole: UserRole;
    roles: UserRole[];
    bio: string;
    avatarUrl?: string;
    providerQrToken?: string;
    upcomingReminderMinutes?: number;
  },
): Promise<void> {
  const now = new Date();

  await tx.user.upsert({
    where: { id: input.id },
    update: {
      phoneNumber: input.phoneNumber,
      email: input.email,
      activeRole: input.activeRole,
      accountStatus: AccountStatus.ACTIVE,
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
      providerQrToken: input.providerQrToken ?? null,
      lastLoginAt: now,
    },
    create: {
      id: input.id,
      phoneNumber: input.phoneNumber,
      email: input.email,
      activeRole: input.activeRole,
      accountStatus: AccountStatus.ACTIVE,
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
      providerQrToken: input.providerQrToken ?? null,
      lastLoginAt: now,
    },
  });

  const profileIdMap: Record<string, string> = {
    [seedIds.userCustomer]: seedIds.profileCustomer,
    [seedIds.userProvider]: seedIds.profileProvider,
    [seedIds.userHybrid]: seedIds.profileHybrid,
    [seedIds.userApplicant]: seedIds.profileApplicant,
  };

  const settingsIdMap: Record<string, string> = {
    [seedIds.userCustomer]: seedIds.settingsCustomer,
    [seedIds.userProvider]: seedIds.settingsProvider,
    [seedIds.userHybrid]: seedIds.settingsHybrid,
    [seedIds.userApplicant]: seedIds.settingsApplicant,
  };

  await tx.userProfile.upsert({
    where: { userId: input.id },
    update: {
      fullName: input.fullName,
      bio: input.bio,
      avatarUrl: input.avatarUrl ?? null,
      deletedAt: null,
    },
    create: {
      id: profileIdMap[input.id],
      userId: input.id,
      fullName: input.fullName,
      bio: input.bio,
      avatarUrl: input.avatarUrl ?? null,
    },
  });

  await tx.userSetting.upsert({
    where: { userId: input.id },
    update: {
      pushEnabled: true,
      upcomingReminderEnabled: true,
      upcomingReminderMinutes: input.upcomingReminderMinutes ?? 60,
      marketingPushEnabled: false,
    },
    create: {
      id: settingsIdMap[input.id],
      userId: input.id,
      pushEnabled: true,
      upcomingReminderEnabled: true,
      upcomingReminderMinutes: input.upcomingReminderMinutes ?? 60,
      marketingPushEnabled: false,
    },
  });

  for (const role of input.roles) {
    const roleIdMap: Record<string, Record<UserRole, string>> = {
      [seedIds.userCustomer]: {
        [UserRole.CUSTOMER]: seedIds.roleCustomerCustomer,
        [UserRole.SERVICE_OWNER]: seedIds.roleCustomerCustomer,
      },
      [seedIds.userProvider]: {
        [UserRole.CUSTOMER]: seedIds.roleProviderProvider,
        [UserRole.SERVICE_OWNER]: seedIds.roleProviderProvider,
      },
      [seedIds.userHybrid]: {
        [UserRole.CUSTOMER]: seedIds.roleHybridCustomer,
        [UserRole.SERVICE_OWNER]: seedIds.roleHybridProvider,
      },
      [seedIds.userApplicant]: {
        [UserRole.CUSTOMER]: seedIds.roleApplicantProvider,
        [UserRole.SERVICE_OWNER]: seedIds.roleApplicantProvider,
      },
    };

    await tx.roleAssignment.upsert({
      where: {
        userId_role: {
          userId: input.id,
          role,
        },
      },
      update: {},
      create: {
        id: roleIdMap[input.id][role],
        userId: input.id,
        role,
      },
    });
  }
}

async function main(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const adminPasswordHash = await hash(adminPassword, 10);
  const now = new Date();

  const pendingStartAt = addDays(now, 2);
  pendingStartAt.setUTCHours(9, 30, 0, 0);

  const approvedStartAt = addDays(now, 3);
  approvedStartAt.setUTCHours(12, 0, 0, 0);

  const completedStartAt = addDays(now, -4);
  completedStartAt.setUTCHours(11, 0, 0, 0);

  const noShowStartAt = addDays(now, -8);
  noShowStartAt.setUTCHours(15, 0, 0, 0);

  await prisma.$transaction(
    async (tx) => {
      await tx.adminCredential.upsert({
        where: { id: seedIds.admin },
        update: {
          email: 'admin@seed.reziphay.local',
          passwordHash: adminPasswordHash,
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
        },
        create: {
          id: seedIds.admin,
          email: 'admin@seed.reziphay.local',
          passwordHash: adminPasswordHash,
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
        },
      });

      const categories = [
        {
          id: seedIds.categoryBarber,
          name: 'Barber',
          slug: 'barber',
          description: 'Haircut, grooming, and beard care services.',
          sortOrder: 1,
        },
        {
          id: seedIds.categoryDental,
          name: 'Dental',
          slug: 'dental',
          description: 'Dentistry and oral care appointments.',
          sortOrder: 2,
        },
        {
          id: seedIds.categoryBeauty,
          name: 'Beauty',
          slug: 'beauty',
          description: 'Beauty, skincare, and personal care sessions.',
          sortOrder: 3,
        },
        {
          id: seedIds.categoryConsulting,
          name: 'Consulting',
          slug: 'consulting',
          description: 'Professional advisory and consultation services.',
          sortOrder: 4,
        },
        {
          id: seedIds.categoryRepair,
          name: 'Repair',
          slug: 'repair',
          description: 'Maintenance and repair bookings.',
          sortOrder: 5,
        },
      ];

      for (const category of categories) {
        await tx.serviceCategory.upsert({
          where: { id: category.id },
          update: {
            name: category.name,
            slug: category.slug,
            description: category.description,
            isActive: true,
            sortOrder: category.sortOrder,
            deletedAt: null,
          },
          create: {
            ...category,
            isActive: true,
          },
        });
      }

      await upsertUser(tx, {
        id: seedIds.userCustomer,
        phoneNumber: '+15550000001',
        email: 'customer@seed.reziphay.local',
        fullName: 'Emma Carter',
        activeRole: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        bio: 'Customer account used for reservation and review flow demos.',
        avatarUrl: 'https://images.reziphay.local/avatar/customer.png',
        upcomingReminderMinutes: 90,
      });

      await upsertUser(tx, {
        id: seedIds.userProvider,
        phoneNumber: '+15550000002',
        email: 'provider@seed.reziphay.local',
        fullName: 'Noah Bennett',
        activeRole: UserRole.SERVICE_OWNER,
        roles: [UserRole.SERVICE_OWNER],
        bio: 'Primary service owner account for brand and service demos.',
        avatarUrl: 'https://images.reziphay.local/avatar/provider.png',
        providerQrToken: 'seed-provider-qr-noah-bennett',
      });

      await upsertUser(tx, {
        id: seedIds.userHybrid,
        phoneNumber: '+15550000003',
        email: 'hybrid@seed.reziphay.local',
        fullName: 'Olivia Morgan',
        activeRole: UserRole.SERVICE_OWNER,
        roles: [UserRole.CUSTOMER, UserRole.SERVICE_OWNER],
        bio: 'Hybrid account carrying both customer and provider roles.',
        avatarUrl: 'https://images.reziphay.local/avatar/hybrid.png',
        providerQrToken: 'seed-provider-qr-olivia-morgan',
        upcomingReminderMinutes: 45,
      });

      await upsertUser(tx, {
        id: seedIds.userApplicant,
        phoneNumber: '+15550000004',
        email: 'applicant@seed.reziphay.local',
        fullName: 'Liam Rivera',
        activeRole: UserRole.SERVICE_OWNER,
        roles: [UserRole.SERVICE_OWNER],
        bio: 'Provider account used to demonstrate brand join request flow.',
        avatarUrl: 'https://images.reziphay.local/avatar/applicant.png',
        providerQrToken: 'seed-provider-qr-liam-rivera',
      });

      await tx.brand.upsert({
        where: { id: seedIds.brandMain },
        update: {
          ownerId: seedIds.userProvider,
          name: 'Clip House Studio',
          slug: 'clip-house-studio',
          address: '214 Market Street, San Francisco, CA',
          description:
            'A modern neighborhood studio offering premium haircut and grooming services.',
          latitude: new Prisma.Decimal('37.7937000'),
          longitude: new Prisma.Decimal('-122.3965000'),
          isVisible: true,
          acceptingReservations: true,
          deletedAt: null,
        },
        create: {
          id: seedIds.brandMain,
          ownerId: seedIds.userProvider,
          name: 'Clip House Studio',
          slug: 'clip-house-studio',
          address: '214 Market Street, San Francisco, CA',
          description:
            'A modern neighborhood studio offering premium haircut and grooming services.',
          latitude: new Prisma.Decimal('37.7937000'),
          longitude: new Prisma.Decimal('-122.3965000'),
          isVisible: true,
          acceptingReservations: true,
        },
      });

      await tx.brandMember.upsert({
        where: { id: seedIds.memberOwner },
        update: {
          brandId: seedIds.brandMain,
          userId: seedIds.userProvider,
          membershipRole: BrandMembershipRole.OWNER,
          isActive: true,
          removedAt: null,
        },
        create: {
          id: seedIds.memberOwner,
          brandId: seedIds.brandMain,
          userId: seedIds.userProvider,
          membershipRole: BrandMembershipRole.OWNER,
          isActive: true,
        },
      });

      await tx.brandMember.upsert({
        where: { id: seedIds.memberHybrid },
        update: {
          brandId: seedIds.brandMain,
          userId: seedIds.userHybrid,
          membershipRole: BrandMembershipRole.MEMBER,
          isActive: true,
          removedAt: null,
        },
        create: {
          id: seedIds.memberHybrid,
          brandId: seedIds.brandMain,
          userId: seedIds.userHybrid,
          membershipRole: BrandMembershipRole.MEMBER,
          isActive: true,
        },
      });

      await tx.brandJoinRequest.upsert({
        where: { id: seedIds.joinRequestApplicant },
        update: {
          brandId: seedIds.brandMain,
          requesterId: seedIds.userApplicant,
          status: 'PENDING',
          message: 'Experienced barber looking to collaborate on weekend shifts.',
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
        },
        create: {
          id: seedIds.joinRequestApplicant,
          brandId: seedIds.brandMain,
          requesterId: seedIds.userApplicant,
          status: 'PENDING',
          message: 'Experienced barber looking to collaborate on weekend shifts.',
        },
      });

      await tx.service.upsert({
        where: { id: seedIds.serviceMain },
        update: {
          providerId: seedIds.userProvider,
          brandId: seedIds.brandMain,
          categoryId: seedIds.categoryBarber,
          name: 'Premium Haircut',
          description:
            'Precision haircut service with wash, styling, and finishing consultation.',
          address: '214 Market Street, San Francisco, CA',
          latitude: new Prisma.Decimal('37.7937000'),
          longitude: new Prisma.Decimal('-122.3965000'),
          price: decimal(35),
          currency: 'USD',
          mode: ServiceMode.SOLO,
          timezone: 'America/Los_Angeles',
          waitingTimeMinutes: 15,
          minLeadTimeMinutes: 60,
          maxLeadTimeDays: 30,
          freeCancellationDeadlineMinutes: 180,
          requiresManualApproval: true,
          isVisible: true,
          acceptingReservations: true,
          deletedAt: null,
        },
        create: {
          id: seedIds.serviceMain,
          providerId: seedIds.userProvider,
          brandId: seedIds.brandMain,
          categoryId: seedIds.categoryBarber,
          name: 'Premium Haircut',
          description:
            'Precision haircut service with wash, styling, and finishing consultation.',
          address: '214 Market Street, San Francisco, CA',
          latitude: new Prisma.Decimal('37.7937000'),
          longitude: new Prisma.Decimal('-122.3965000'),
          price: decimal(35),
          currency: 'USD',
          mode: ServiceMode.SOLO,
          timezone: 'America/Los_Angeles',
          waitingTimeMinutes: 15,
          minLeadTimeMinutes: 60,
          maxLeadTimeDays: 30,
          freeCancellationDeadlineMinutes: 180,
          requiresManualApproval: true,
          isVisible: true,
          acceptingReservations: true,
        },
      });

      const servicePhotos = [
        {
          id: seedIds.servicePhotoCover,
          url: 'https://images.reziphay.local/services/premium-haircut-cover.jpg',
          sortOrder: 0,
        },
        {
          id: seedIds.servicePhotoGallery,
          url: 'https://images.reziphay.local/services/premium-haircut-gallery.jpg',
          sortOrder: 1,
        },
      ];

      for (const photo of servicePhotos) {
        await tx.servicePhoto.upsert({
          where: { id: photo.id },
          update: {
            serviceId: seedIds.serviceMain,
            url: photo.url,
            sortOrder: photo.sortOrder,
            deletedAt: null,
          },
          create: {
            ...photo,
            serviceId: seedIds.serviceMain,
          },
        });
      }

      const availabilityRules = [
        {
          id: seedIds.availabilityMonday,
          weekday: 1,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
        },
        {
          id: seedIds.availabilityTuesday,
          weekday: 2,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
        },
        {
          id: seedIds.availabilitySaturday,
          weekday: 6,
          startMinute: 10 * 60,
          endMinute: 15 * 60,
        },
      ];

      for (const rule of availabilityRules) {
        await tx.serviceAvailabilityRule.upsert({
          where: { id: rule.id },
          update: {
            serviceId: seedIds.serviceMain,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            isActive: true,
            deletedAt: null,
          },
          create: {
            ...rule,
            serviceId: seedIds.serviceMain,
            isActive: true,
          },
        });
      }

      await tx.serviceAvailabilityBreak.upsert({
        where: { id: seedIds.breakMondayLunch },
        update: {
          availabilityRuleId: seedIds.availabilityMonday,
          startMinute: 13 * 60,
          endMinute: 14 * 60,
        },
        create: {
          id: seedIds.breakMondayLunch,
          availabilityRuleId: seedIds.availabilityMonday,
          startMinute: 13 * 60,
          endMinute: 14 * 60,
        },
      });

      await tx.serviceScheduleOverride.upsert({
        where: { id: seedIds.closureHoliday },
        update: {
          serviceId: seedIds.serviceMain,
          overrideType: 'CLOSED',
          startsAt: addDays(now, 10),
          endsAt: addDays(now, 11),
          reason: 'Team offsite and training day.',
          deletedAt: null,
        },
        create: {
          id: seedIds.closureHoliday,
          serviceId: seedIds.serviceMain,
          overrideType: 'CLOSED',
          startsAt: addDays(now, 10),
          endsAt: addDays(now, 11),
          reason: 'Team offsite and training day.',
        },
      });

      const reservations = [
        {
          id: seedIds.reservationPending,
          customerId: seedIds.userCustomer,
          status: ReservationStatus.PENDING,
          requestedStartAt: pendingStartAt,
          note: 'First-time customer, prefers a skin fade.',
          manualApprovalDeadlineAt: addMinutes(now, 5),
          approvedAt: null,
          completedAt: null,
          noShowMarkedAt: null,
          completionMethod: null,
        },
        {
          id: seedIds.reservationApproved,
          customerId: seedIds.userCustomer,
          status: ReservationStatus.APPROVED,
          requestedStartAt: approvedStartAt,
          note: 'Returning customer, regular trim.',
          manualApprovalDeadlineAt: addMinutes(now, -15),
          approvedAt: addMinutes(now, -20),
          completedAt: null,
          noShowMarkedAt: null,
          completionMethod: null,
        },
        {
          id: seedIds.reservationCompleted,
          customerId: seedIds.userHybrid,
          status: ReservationStatus.COMPLETED,
          requestedStartAt: completedStartAt,
          note: 'Completed appointment used for review testing.',
          manualApprovalDeadlineAt: addDays(completedStartAt, -1),
          approvedAt: addDays(completedStartAt, -1),
          completedAt: addMinutes(completedStartAt, 50),
          noShowMarkedAt: null,
          completionMethod: CompletionMethod.MANUAL,
        },
        {
          id: seedIds.reservationNoShow,
          customerId: seedIds.userCustomer,
          status: ReservationStatus.NO_SHOW,
          requestedStartAt: noShowStartAt,
          note: 'Historic no-show reservation used for penalty flow demos.',
          manualApprovalDeadlineAt: addDays(noShowStartAt, -1),
          approvedAt: addDays(noShowStartAt, -1),
          completedAt: null,
          noShowMarkedAt: addMinutes(noShowStartAt, 20),
          completionMethod: null,
        },
      ];

      for (const reservation of reservations) {
        await tx.reservation.upsert({
          where: { id: reservation.id },
          update: {
            serviceId: seedIds.serviceMain,
            customerId: reservation.customerId,
            providerId: seedIds.userProvider,
            brandId: seedIds.brandMain,
            status: reservation.status,
            requestedStartAt: reservation.requestedStartAt,
            requestedEndAt: addMinutes(reservation.requestedStartAt, 45),
            note: reservation.note,
            manualApprovalDeadlineAt: reservation.manualApprovalDeadlineAt,
            rejectionReason: null,
            cancellationReason: null,
            customerChangeRequestReason: null,
            providerChangeRequestReason: null,
            completionMethod: reservation.completionMethod,
            approvedAt: reservation.approvedAt,
            rejectedAt: null,
            cancelledAt: null,
            completedAt: reservation.completedAt,
            expiredAt: null,
            noShowMarkedAt: reservation.noShowMarkedAt,
            requiresManualApproval: true,
            waitingTimeMinutesSnapshot: 15,
            freeCancellationDeadlineSnapshot: 180,
            serviceNameSnapshot: 'Premium Haircut',
            providerNameSnapshot: 'Noah Bennett',
            brandNameSnapshot: 'Clip House Studio',
            serviceTimezoneSnapshot: 'America/Los_Angeles',
            priceSnapshot: decimal(35),
            currencySnapshot: 'USD',
          },
          create: {
            id: reservation.id,
            serviceId: seedIds.serviceMain,
            customerId: reservation.customerId,
            providerId: seedIds.userProvider,
            brandId: seedIds.brandMain,
            status: reservation.status,
            requestedStartAt: reservation.requestedStartAt,
            requestedEndAt: addMinutes(reservation.requestedStartAt, 45),
            note: reservation.note,
            manualApprovalDeadlineAt: reservation.manualApprovalDeadlineAt,
            completionMethod: reservation.completionMethod,
            approvedAt: reservation.approvedAt,
            completedAt: reservation.completedAt,
            noShowMarkedAt: reservation.noShowMarkedAt,
            requiresManualApproval: true,
            waitingTimeMinutesSnapshot: 15,
            freeCancellationDeadlineSnapshot: 180,
            serviceNameSnapshot: 'Premium Haircut',
            providerNameSnapshot: 'Noah Bennett',
            brandNameSnapshot: 'Clip House Studio',
            serviceTimezoneSnapshot: 'America/Los_Angeles',
            priceSnapshot: decimal(35),
            currencySnapshot: 'USD',
          },
        });
      }

      const histories = [
        {
          id: seedIds.historyPendingCreated,
          reservationId: seedIds.reservationPending,
          fromStatus: null,
          toStatus: ReservationStatus.PENDING,
          actorType: ReservationActorType.CUSTOMER,
          actorUserId: seedIds.userCustomer,
          reason: 'Reservation request created by customer.',
        },
        {
          id: seedIds.historyApprovedCreated,
          reservationId: seedIds.reservationApproved,
          fromStatus: null,
          toStatus: ReservationStatus.PENDING,
          actorType: ReservationActorType.CUSTOMER,
          actorUserId: seedIds.userCustomer,
          reason: 'Reservation request created by customer.',
        },
        {
          id: seedIds.historyApprovedApproved,
          reservationId: seedIds.reservationApproved,
          fromStatus: ReservationStatus.PENDING,
          toStatus: ReservationStatus.APPROVED,
          actorType: ReservationActorType.PROVIDER,
          actorUserId: seedIds.userProvider,
          reason: 'Reservation approved by provider.',
        },
        {
          id: seedIds.historyCompletedCreated,
          reservationId: seedIds.reservationCompleted,
          fromStatus: null,
          toStatus: ReservationStatus.PENDING,
          actorType: ReservationActorType.CUSTOMER,
          actorUserId: seedIds.userHybrid,
          reason: 'Reservation request created by hybrid user.',
        },
        {
          id: seedIds.historyCompletedApproved,
          reservationId: seedIds.reservationCompleted,
          fromStatus: ReservationStatus.PENDING,
          toStatus: ReservationStatus.APPROVED,
          actorType: ReservationActorType.PROVIDER,
          actorUserId: seedIds.userProvider,
          reason: 'Reservation approved by provider.',
        },
        {
          id: seedIds.historyCompletedCompleted,
          reservationId: seedIds.reservationCompleted,
          fromStatus: ReservationStatus.APPROVED,
          toStatus: ReservationStatus.COMPLETED,
          actorType: ReservationActorType.PROVIDER,
          actorUserId: seedIds.userProvider,
          reason: 'Reservation manually completed by provider.',
        },
        {
          id: seedIds.historyNoShowCreated,
          reservationId: seedIds.reservationNoShow,
          fromStatus: null,
          toStatus: ReservationStatus.PENDING,
          actorType: ReservationActorType.CUSTOMER,
          actorUserId: seedIds.userCustomer,
          reason: 'Reservation request created by customer.',
        },
        {
          id: seedIds.historyNoShowApproved,
          reservationId: seedIds.reservationNoShow,
          fromStatus: ReservationStatus.PENDING,
          toStatus: ReservationStatus.APPROVED,
          actorType: ReservationActorType.PROVIDER,
          actorUserId: seedIds.userProvider,
          reason: 'Reservation approved by provider.',
        },
        {
          id: seedIds.historyNoShowMarked,
          reservationId: seedIds.reservationNoShow,
          fromStatus: ReservationStatus.APPROVED,
          toStatus: ReservationStatus.NO_SHOW,
          actorType: ReservationActorType.SYSTEM,
          actorUserId: null,
          reason: 'Reservation marked as no-show after waiting time window.',
        },
      ];

      for (const history of histories) {
        await tx.reservationStatusHistory.upsert({
          where: { id: history.id },
          update: {
            reservationId: history.reservationId,
            fromStatus: history.fromStatus,
            toStatus: history.toStatus,
            reason: history.reason,
            actorType: history.actorType,
            actorUserId: history.actorUserId,
            actorAdminCredentialId: null,
            metadata: null,
          },
          create: {
            id: history.id,
            reservationId: history.reservationId,
            fromStatus: history.fromStatus,
            toStatus: history.toStatus,
            reason: history.reason,
            actorType: history.actorType,
            actorUserId: history.actorUserId,
            actorAdminCredentialId: null,
          },
        });
      }

      await tx.reservationChangeRequest.upsert({
        where: { id: seedIds.changeRequestApproved },
        update: {
          reservationId: seedIds.reservationApproved,
          requesterType: ReservationPartyType.CUSTOMER,
          requesterUserId: seedIds.userCustomer,
          proposedStartAt: addMinutes(approvedStartAt, 30),
          proposedEndAt: addMinutes(approvedStartAt, 75),
          reason: 'Customer requested a slightly later start time.',
          status: 'PENDING',
          reviewedByUserId: null,
          reviewedAt: null,
          resolvedAt: null,
          resolutionNote: null,
        },
        create: {
          id: seedIds.changeRequestApproved,
          reservationId: seedIds.reservationApproved,
          requesterType: ReservationPartyType.CUSTOMER,
          requesterUserId: seedIds.userCustomer,
          proposedStartAt: addMinutes(approvedStartAt, 30),
          proposedEndAt: addMinutes(approvedStartAt, 75),
          reason: 'Customer requested a slightly later start time.',
          status: 'PENDING',
        },
      });

      await tx.review.upsert({
        where: { id: seedIds.reviewCompleted },
        update: {
          reservationId: seedIds.reservationCompleted,
          authorId: seedIds.userHybrid,
          comment:
            'Clean result, on-time service, and an easy booking experience.',
          deletedAt: null,
        },
        create: {
          id: seedIds.reviewCompleted,
          reservationId: seedIds.reservationCompleted,
          authorId: seedIds.userHybrid,
          comment:
            'Clean result, on-time service, and an easy booking experience.',
        },
      });

      const reviewTargets = [
        {
          id: seedIds.reviewTargetService,
          targetType: ReviewTargetType.SERVICE,
          targetId: seedIds.serviceMain,
          rating: 5,
        },
        {
          id: seedIds.reviewTargetProvider,
          targetType: ReviewTargetType.PROVIDER,
          targetId: seedIds.userProvider,
          rating: 5,
        },
        {
          id: seedIds.reviewTargetBrand,
          targetType: ReviewTargetType.BRAND,
          targetId: seedIds.brandMain,
          rating: 4,
        },
      ];

      for (const target of reviewTargets) {
        await tx.reviewTarget.upsert({
          where: { id: target.id },
          update: {
            reviewId: seedIds.reviewCompleted,
            targetType: target.targetType,
            targetId: target.targetId,
            rating: target.rating,
          },
          create: {
            id: target.id,
            reviewId: seedIds.reviewCompleted,
            targetType: target.targetType,
            targetId: target.targetId,
            rating: target.rating,
          },
        });
      }

      await tx.reviewReply.upsert({
        where: { id: seedIds.reviewReplyCompleted },
        update: {
          reviewId: seedIds.reviewCompleted,
          authorId: seedIds.userProvider,
          message: 'Thank you for the detailed feedback and for visiting us.',
          deletedAt: null,
        },
        create: {
          id: seedIds.reviewReplyCompleted,
          reviewId: seedIds.reviewCompleted,
          authorId: seedIds.userProvider,
          message: 'Thank you for the detailed feedback and for visiting us.',
        },
      });

      await tx.penaltyPoint.upsert({
        where: { id: seedIds.penaltyNoShow },
        update: {
          userId: seedIds.userCustomer,
          reservationId: seedIds.reservationNoShow,
          reason: PenaltyReason.NO_SHOW,
          issuedAt: addMinutes(noShowStartAt, 20),
          expiresAt: addDays(noShowStartAt, 90),
          revokedAt: null,
          isActive: true,
        },
        create: {
          id: seedIds.penaltyNoShow,
          userId: seedIds.userCustomer,
          reservationId: seedIds.reservationNoShow,
          reason: PenaltyReason.NO_SHOW,
          issuedAt: addMinutes(noShowStartAt, 20),
          expiresAt: addDays(noShowStartAt, 90),
          isActive: true,
        },
      });

      await tx.penaltyDispute.upsert({
        where: { id: seedIds.penaltyDisputeNoShow },
        update: {
          penaltyPointId: seedIds.penaltyNoShow,
          userId: seedIds.userCustomer,
          reason: 'Customer claims arrival happened within the grace period.',
          details:
            'Seeded dispute record for testing penalty dispute dashboards.',
          status: PenaltyDisputeStatus.PENDING,
          reviewedByAdminCredentialId: null,
          reviewedAt: null,
          resolutionNote: null,
        },
        create: {
          id: seedIds.penaltyDisputeNoShow,
          penaltyPointId: seedIds.penaltyNoShow,
          userId: seedIds.userCustomer,
          reason: 'Customer claims arrival happened within the grace period.',
          details:
            'Seeded dispute record for testing penalty dispute dashboards.',
          status: PenaltyDisputeStatus.PENDING,
        },
      });

      const notifications = [
        {
          id: seedIds.notificationProviderPending,
          userId: seedIds.userProvider,
          type: NotificationType.RESERVATION_RECEIVED,
          title: 'New reservation request',
          body: 'Emma Carter requested Premium Haircut for an upcoming slot.',
          routeScreen: NotificationScreen.PROVIDER_RESERVATION_DETAIL,
          routeParams: { reservationId: seedIds.reservationPending },
        },
        {
          id: seedIds.notificationCustomerApproved,
          userId: seedIds.userCustomer,
          type: NotificationType.RESERVATION_CONFIRMED,
          title: 'Reservation approved',
          body: 'Your Premium Haircut reservation has been approved.',
          routeScreen: NotificationScreen.RESERVATION_DETAIL,
          routeParams: { reservationId: seedIds.reservationApproved },
        },
        {
          id: seedIds.notificationCustomerCompleted,
          userId: seedIds.userHybrid,
          type: NotificationType.REVIEW_RECEIVED,
          title: 'Review flow unlocked',
          body: 'Your completed reservation is now ready for review.',
          routeScreen: NotificationScreen.REVIEW_DETAIL,
          routeParams: { reservationId: seedIds.reservationCompleted },
        },
      ];

      for (const notification of notifications) {
        await tx.notification.upsert({
          where: { id: notification.id },
          update: {
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            routeScreen: notification.routeScreen,
            routeParams: notification.routeParams,
            isRead: false,
            readAt: null,
            deliveredAt: now,
          },
          create: {
            id: notification.id,
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            routeScreen: notification.routeScreen,
            routeParams: notification.routeParams,
            isRead: false,
            deliveredAt: now,
          },
        });
      }

      await tx.pushDevice.upsert({
        where: { id: seedIds.pushDeviceCustomer },
        update: {
          userId: seedIds.userCustomer,
          platform: 'IOS',
          deviceToken: 'seed-device-token-customer-ios',
          deviceName: 'Emma iPhone',
          appVersion: '1.0.0',
          lastSeenAt: now,
          isActive: true,
          revokedAt: null,
        },
        create: {
          id: seedIds.pushDeviceCustomer,
          userId: seedIds.userCustomer,
          platform: 'IOS',
          deviceToken: 'seed-device-token-customer-ios',
          deviceName: 'Emma iPhone',
          appVersion: '1.0.0',
          lastSeenAt: now,
          isActive: true,
        },
      });

      const visibilityAssignments = [
        {
          id: seedIds.visibilityBrandFeatured,
          targetType: VisibilityTargetType.BRAND,
          targetId: seedIds.brandMain,
          label: VisibilityLabel.FEATURED,
          notes: 'Featured by seed admin for homepage demo.',
        },
        {
          id: seedIds.visibilityServiceVip,
          targetType: VisibilityTargetType.SERVICE,
          targetId: seedIds.serviceMain,
          label: VisibilityLabel.VIP,
          notes: 'VIP service slot used for discovery ranking demo.',
        },
      ];

      for (const assignment of visibilityAssignments) {
        await tx.visibilityLabelAssignment.upsert({
          where: { id: assignment.id },
          update: {
            targetType: assignment.targetType,
            targetId: assignment.targetId,
            label: assignment.label,
            source: VisibilitySourceType.ADMIN,
            startsAt: now,
            endsAt: addDays(now, 30),
            assignedByAdminCredentialId: seedIds.admin,
            notes: assignment.notes,
          },
          create: {
            id: assignment.id,
            targetType: assignment.targetType,
            targetId: assignment.targetId,
            label: assignment.label,
            source: VisibilitySourceType.ADMIN,
            startsAt: now,
            endsAt: addDays(now, 30),
            assignedByAdminCredentialId: seedIds.admin,
            notes: assignment.notes,
          },
        });
      }

      await tx.sponsoredPlacement.upsert({
        where: { id: seedIds.sponsoredServiceMain },
        update: {
          targetType: VisibilityTargetType.SERVICE,
          targetId: seedIds.serviceMain,
          slotKey: 'home.hero.primary',
          status: 'ACTIVE',
          startsAt: now,
          endsAt: addDays(now, 14),
          createdByAdminCredentialId: seedIds.admin,
          metadata: {
            budgetCurrency: 'USD',
            note: 'Seeded sponsored placement for marketing demos.',
          },
        },
        create: {
          id: seedIds.sponsoredServiceMain,
          targetType: VisibilityTargetType.SERVICE,
          targetId: seedIds.serviceMain,
          slotKey: 'home.hero.primary',
          status: 'ACTIVE',
          startsAt: now,
          endsAt: addDays(now, 14),
          createdByAdminCredentialId: seedIds.admin,
          metadata: {
            budgetCurrency: 'USD',
            note: 'Seeded sponsored placement for marketing demos.',
          },
        },
      });

      await tx.abuseReport.upsert({
        where: { id: seedIds.abuseReportReview },
        update: {
          reporterUserId: seedIds.userCustomer,
          targetType: 'REVIEW',
          targetId: seedIds.reviewCompleted,
          reason: 'Testing moderation queue visibility with a sample report.',
          details: 'This is a seeded moderation report and should remain open.',
          status: 'OPEN',
          reviewedByAdminCredentialId: null,
          reviewedAt: null,
          resolutionNote: null,
        },
        create: {
          id: seedIds.abuseReportReview,
          reporterUserId: seedIds.userCustomer,
          targetType: 'REVIEW',
          targetId: seedIds.reviewCompleted,
          reason: 'Testing moderation queue visibility with a sample report.',
          details: 'This is a seeded moderation report and should remain open.',
          status: 'OPEN',
        },
      });

      await tx.auditLog.upsert({
        where: { id: seedIds.auditReservationCompleted },
        update: {
          actorType: 'ADMIN',
          actorUserId: null,
          actorAdminCredentialId: seedIds.admin,
          action: 'seed.completed_reservation.created',
          entityType: 'Reservation',
          entityId: seedIds.reservationCompleted,
          payload: {
            reservationId: seedIds.reservationCompleted,
            source: 'prisma-seed',
          },
        },
        create: {
          id: seedIds.auditReservationCompleted,
          actorType: 'ADMIN',
          actorAdminCredentialId: seedIds.admin,
          action: 'seed.completed_reservation.created',
          entityType: 'Reservation',
          entityId: seedIds.reservationCompleted,
          payload: {
            reservationId: seedIds.reservationCompleted,
            source: 'prisma-seed',
          },
        },
      });
    },
    {
      timeout: 60_000,
      maxWait: 10_000,
    },
  );

  console.log('Seed completed successfully.');
  console.log('Admin login: admin@seed.reziphay.local');
  console.log(`Admin password: ${adminPassword}`);
  console.log('Customer phone: +15550000001');
  console.log('Provider phone: +15550000002');
  console.log('Hybrid user phone: +15550000003');
}

void main()
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

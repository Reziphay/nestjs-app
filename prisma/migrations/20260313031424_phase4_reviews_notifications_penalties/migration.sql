-- CreateEnum
CREATE TYPE "PenaltyReason" AS ENUM ('NO_SHOW');

-- CreateEnum
CREATE TYPE "PenaltyActionType" AS ENUM ('SUSPEND_1_MONTH', 'CLOSE_INDEFINITELY');

-- CreateEnum
CREATE TYPE "ReservationObjectionType" AS ENUM ('NO_SHOW_DISPUTE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationObjectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('SERVICE', 'SERVICE_OWNER', 'BRAND');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'BRAND', 'SERVICE', 'REVIEW');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION_RECEIVED', 'RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED', 'RESERVATION_CHANGE_REQUESTED', 'RESERVATION_COMPLETED', 'RESERVATION_EXPIRED', 'RESERVATION_NO_SHOW', 'PENALTY_APPLIED', 'REVIEW_RECEIVED', 'REVIEW_REPORTED', 'OBJECTION_RECEIVED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "penalty_points" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reservation_id" UUID,
    "points" INTEGER NOT NULL DEFAULT 1,
    "reason" "PenaltyReason" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_actions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "triggered_by_points" INTEGER NOT NULL,
    "action" "PenaltyActionType" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_objections" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "objection_type" "ReservationObjectionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReservationObjectionStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by_admin_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_objections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "service_id" UUID,
    "service_owner_user_id" UUID,
    "brand_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_targets" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" UUID NOT NULL,

    CONSTRAINT "review_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "handled_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data_json" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_rating_stats" (
    "service_id" UUID NOT NULL,
    "avg_rating" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_rating_stats_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "service_owner_rating_stats" (
    "user_id" UUID NOT NULL,
    "avg_rating" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_owner_rating_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "brand_rating_stats" (
    "brand_id" UUID NOT NULL,
    "avg_rating" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_rating_stats_pkey" PRIMARY KEY ("brand_id")
);

-- CreateIndex
CREATE INDEX "penalty_points_user_id_is_active_idx" ON "penalty_points"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "penalty_points_expires_at_is_active_idx" ON "penalty_points"("expires_at", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_points_reservation_id_reason_key" ON "penalty_points"("reservation_id", "reason");

-- CreateIndex
CREATE INDEX "penalty_actions_user_id_is_active_idx" ON "penalty_actions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "penalty_actions_action_is_active_idx" ON "penalty_actions"("action", "is_active");

-- CreateIndex
CREATE INDEX "reservation_objections_reservation_id_status_idx" ON "reservation_objections"("reservation_id", "status");

-- CreateIndex
CREATE INDEX "reservation_objections_user_id_status_idx" ON "reservation_objections"("user_id", "status");

-- CreateIndex
CREATE INDEX "reviews_service_id_is_deleted_idx" ON "reviews"("service_id", "is_deleted");

-- CreateIndex
CREATE INDEX "reviews_owner_id_is_deleted_idx" ON "reviews"("service_owner_user_id", "is_deleted");

-- CreateIndex
CREATE INDEX "reviews_brand_id_is_deleted_idx" ON "reviews"("brand_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservation_id_author_user_id_key" ON "reviews"("reservation_id", "author_user_id");

-- CreateIndex
CREATE INDEX "review_targets_target_type_target_id_idx" ON "review_targets"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_targets_review_id_target_type_key" ON "review_targets"("review_id", "target_type");

-- CreateIndex
CREATE INDEX "review_replies_review_id_created_at_idx" ON "review_replies"("review_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_replies_review_id_author_user_id_key" ON "review_replies"("review_id", "author_user_id");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_status_idx" ON "reports"("reporter_user_id", "status");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_status_idx" ON "reports"("target_type", "target_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_last_seen_at_idx" ON "push_tokens"("user_id", "last_seen_at");

-- AddForeignKey
ALTER TABLE "penalty_points" ADD CONSTRAINT "penalty_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_points" ADD CONSTRAINT "penalty_points_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_actions" ADD CONSTRAINT "penalty_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_objections" ADD CONSTRAINT "reservation_objections_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_objections" ADD CONSTRAINT "reservation_objections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_objections" ADD CONSTRAINT "reservation_objections_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_owner_user_id_fkey" FOREIGN KEY ("service_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_targets" ADD CONSTRAINT "review_targets_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_admin_id_fkey" FOREIGN KEY ("handled_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_rating_stats" ADD CONSTRAINT "service_rating_stats_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_owner_rating_stats" ADD CONSTRAINT "service_owner_rating_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_rating_stats" ADD CONSTRAINT "brand_rating_stats_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

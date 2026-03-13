-- CreateEnum
CREATE TYPE "VisibilityTargetType" AS ENUM ('BRAND', 'SERVICE', 'USER');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('USER', 'REPORT', 'RESERVATION_OBJECTION', 'VISIBILITY_LABEL', 'BRAND_VISIBILITY_ASSIGNMENT', 'SERVICE_VISIBILITY_ASSIGNMENT', 'USER_VISIBILITY_ASSIGNMENT');

-- CreateTable
CREATE TABLE "visibility_labels" (
    "id" UUID NOT NULL,
    "target_type" "VisibilityTargetType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_visibility_assignments" (
    "id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visibility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_visibility_assignments" (
    "id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_visibility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_visibility_assignments" (
    "id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_visibility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" "AdminAuditTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visibility_labels_target_type_active_priority_idx" ON "visibility_labels"("target_type", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "visibility_labels_target_type_slug_key" ON "visibility_labels"("target_type", "slug");

-- CreateIndex
CREATE INDEX "brand_visibility_assignments_label_period_idx" ON "brand_visibility_assignments"("label_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "brand_visibility_assignments_brand_period_idx" ON "brand_visibility_assignments"("brand_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "service_visibility_assignments_label_period_idx" ON "service_visibility_assignments"("label_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "service_visibility_assignments_service_period_idx" ON "service_visibility_assignments"("service_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "user_visibility_assignments_label_period_idx" ON "user_visibility_assignments"("label_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "user_visibility_assignments_user_period_idx" ON "user_visibility_assignments"("user_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_created_at_idx" ON "admin_audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "brands_name_idx" ON "brands"("name");

-- CreateIndex
CREATE INDEX "users_full_name_idx" ON "users"("full_name");

-- AddForeignKey
ALTER TABLE "visibility_labels" ADD CONSTRAINT "visibility_labels_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visibility_assignments" ADD CONSTRAINT "brand_visibility_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "visibility_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visibility_assignments" ADD CONSTRAINT "brand_visibility_assignments_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visibility_assignments" ADD CONSTRAINT "brand_visibility_assignments_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_visibility_assignments" ADD CONSTRAINT "service_visibility_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "visibility_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_visibility_assignments" ADD CONSTRAINT "service_visibility_assignments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_visibility_assignments" ADD CONSTRAINT "service_visibility_assignments_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_visibility_assignments" ADD CONSTRAINT "user_visibility_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "visibility_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_visibility_assignments" ADD CONSTRAINT "user_visibility_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_visibility_assignments" ADD CONSTRAINT "user_visibility_assignments_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

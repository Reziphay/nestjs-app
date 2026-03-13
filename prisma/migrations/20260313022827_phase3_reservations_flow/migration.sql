-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_OWNER', 'CHANGE_REQUESTED_BY_CUSTOMER', 'CHANGE_REQUESTED_BY_OWNER', 'COMPLETED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationActorType" AS ENUM ('SYSTEM', 'CUSTOMER', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReservationChangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationCompletionMethod" AS ENUM ('QR', 'MANUAL');

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "service_owner_user_id" UUID NOT NULL,
    "brand_id" UUID,
    "requested_start_at" TIMESTAMP(3) NOT NULL,
    "requested_end_at" TIMESTAMP(3),
    "status" "ReservationStatus" NOT NULL,
    "approval_expires_at" TIMESTAMP(3),
    "customer_note" TEXT,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "free_cancellation_eligible_at_cancellation" BOOLEAN,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_status_history" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "from_status" "ReservationStatus",
    "to_status" "ReservationStatus" NOT NULL,
    "reason" TEXT,
    "actor_type" "ReservationActorType" NOT NULL,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_change_requests" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "requested_start_at" TIMESTAMP(3) NOT NULL,
    "requested_end_at" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "ReservationChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "previous_status" "ReservationStatus" NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_completion_records" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "method" "ReservationCompletionMethod" NOT NULL,
    "completed_by_user_id" UUID NOT NULL,
    "customer_verified_user_id" UUID,
    "qr_payload_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_completion_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_customer_user_id_status_created_at_idx" ON "reservations"("customer_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reservations_owner_user_id_status_created_at_idx" ON "reservations"("service_owner_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reservations_service_id_status_start_at_idx" ON "reservations"("service_id", "status", "requested_start_at");

-- CreateIndex
CREATE INDEX "reservations_brand_id_idx" ON "reservations"("brand_id");

-- CreateIndex
CREATE INDEX "reservation_status_history_reservation_id_created_at_idx" ON "reservation_status_history"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "reservation_status_history_actor_user_id_idx" ON "reservation_status_history"("actor_user_id");

-- CreateIndex
CREATE INDEX "reservation_change_requests_reservation_id_status_idx" ON "reservation_change_requests"("reservation_id", "status");

-- CreateIndex
CREATE INDEX "reservation_change_requests_requested_by_status_idx" ON "reservation_change_requests"("requested_by_user_id", "status");

-- CreateIndex
CREATE INDEX "reservation_completion_records_reservation_id_created_at_idx" ON "reservation_completion_records"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "reservation_completion_records_completed_by_idx" ON "reservation_completion_records"("completed_by_user_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_service_owner_user_id_fkey" FOREIGN KEY ("service_owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_change_requests" ADD CONSTRAINT "reservation_change_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_change_requests" ADD CONSTRAINT "reservation_change_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_change_requests" ADD CONSTRAINT "reservation_change_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_completion_records" ADD CONSTRAINT "reservation_completion_records_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_completion_records" ADD CONSTRAINT "reservation_completion_records_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_completion_records" ADD CONSTRAINT "reservation_completion_records_customer_verified_user_id_fkey" FOREIGN KEY ("customer_verified_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

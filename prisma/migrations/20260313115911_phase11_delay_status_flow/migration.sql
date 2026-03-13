-- CreateEnum
CREATE TYPE "ReservationDelayStatus" AS ENUM ('NONE', 'RUNNING_LATE', 'ARRIVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RESERVATION_DELAY_UPDATED';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "arrived_at" TIMESTAMP(3),
ADD COLUMN     "delay_note" TEXT,
ADD COLUMN     "delay_status" "ReservationDelayStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "delay_status_updated_at" TIMESTAMP(3),
ADD COLUMN     "estimated_arrival_minutes" INTEGER;

-- CreateTable
CREATE TABLE "reservation_delay_updates" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "status" "ReservationDelayStatus" NOT NULL,
    "estimated_arrival_minutes" INTEGER,
    "note" TEXT,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_delay_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_delay_updates_reservation_id_created_at_idx" ON "reservation_delay_updates"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "reservation_delay_updates_updated_by_user_id_idx" ON "reservation_delay_updates"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "reservations_status_delay_status_start_at_idx" ON "reservations"("status", "delay_status", "requested_start_at");

-- AddForeignKey
ALTER TABLE "reservation_delay_updates" ADD CONSTRAINT "reservation_delay_updates_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_delay_updates" ADD CONSTRAINT "reservation_delay_updates_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

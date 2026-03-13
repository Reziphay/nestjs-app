-- CreateTable
CREATE TABLE "service_manual_blocks" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_manual_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_manual_blocks_service_id_starts_at_idx" ON "service_manual_blocks"("service_id", "starts_at");

-- CreateIndex
CREATE INDEX "service_manual_blocks_service_id_ends_at_idx" ON "service_manual_blocks"("service_id", "ends_at");

-- AddForeignKey
ALTER TABLE "service_manual_blocks" ADD CONSTRAINT "service_manual_blocks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

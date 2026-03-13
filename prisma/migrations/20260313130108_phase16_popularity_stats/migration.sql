-- CreateTable
CREATE TABLE "service_popularity_stats" (
    "service_id" UUID NOT NULL,
    "popularity_score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_popularity_stats_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "service_owner_popularity_stats" (
    "user_id" UUID NOT NULL,
    "popularity_score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_owner_popularity_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "brand_popularity_stats" (
    "brand_id" UUID NOT NULL,
    "popularity_score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_popularity_stats_pkey" PRIMARY KEY ("brand_id")
);

-- AddForeignKey
ALTER TABLE "service_popularity_stats" ADD CONSTRAINT "service_popularity_stats_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_owner_popularity_stats" ADD CONSTRAINT "service_owner_popularity_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_popularity_stats" ADD CONSTRAINT "brand_popularity_stats_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

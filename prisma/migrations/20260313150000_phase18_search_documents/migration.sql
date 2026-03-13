CREATE TABLE "service_search_documents" (
    "service_id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "brand_name" TEXT,
    "owner_full_name" TEXT NOT NULL,
    "category_name" TEXT,
    "city" TEXT,
    "country" TEXT,
    "search_text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_search_documents_pkey" PRIMARY KEY ("service_id")
);

CREATE TABLE "brand_search_documents" (
    "brand_id" UUID NOT NULL,
    "brand_name" TEXT NOT NULL,
    "owner_full_name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "search_text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_search_documents_pkey" PRIMARY KEY ("brand_id")
);

CREATE TABLE "provider_search_documents" (
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "service_names" TEXT,
    "brand_names" TEXT,
    "city_names" TEXT,
    "country_names" TEXT,
    "search_text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_search_documents_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "service_search_documents_service_name_idx" ON "service_search_documents"("service_name");
CREATE INDEX "service_search_documents_brand_name_idx" ON "service_search_documents"("brand_name");
CREATE INDEX "service_search_documents_owner_full_name_idx" ON "service_search_documents"("owner_full_name");
CREATE INDEX "brand_search_documents_brand_name_idx" ON "brand_search_documents"("brand_name");
CREATE INDEX "brand_search_documents_owner_full_name_idx" ON "brand_search_documents"("owner_full_name");
CREATE INDEX "provider_search_documents_full_name_idx" ON "provider_search_documents"("full_name");

CREATE INDEX "service_search_documents_service_name_trgm_idx"
  ON "service_search_documents"
  USING GIN (lower("service_name") gin_trgm_ops);

CREATE INDEX "service_search_documents_brand_name_trgm_idx"
  ON "service_search_documents"
  USING GIN (lower(coalesce("brand_name", '')) gin_trgm_ops);

CREATE INDEX "service_search_documents_owner_full_name_trgm_idx"
  ON "service_search_documents"
  USING GIN (lower("owner_full_name") gin_trgm_ops);

CREATE INDEX "service_search_documents_search_text_idx"
  ON "service_search_documents"
  USING GIN (to_tsvector('simple', coalesce("search_text", '')));

CREATE INDEX "brand_search_documents_brand_name_trgm_idx"
  ON "brand_search_documents"
  USING GIN (lower("brand_name") gin_trgm_ops);

CREATE INDEX "brand_search_documents_owner_full_name_trgm_idx"
  ON "brand_search_documents"
  USING GIN (lower("owner_full_name") gin_trgm_ops);

CREATE INDEX "brand_search_documents_search_text_idx"
  ON "brand_search_documents"
  USING GIN (to_tsvector('simple', coalesce("search_text", '')));

CREATE INDEX "provider_search_documents_full_name_trgm_idx"
  ON "provider_search_documents"
  USING GIN (lower("full_name") gin_trgm_ops);

CREATE INDEX "provider_search_documents_service_names_trgm_idx"
  ON "provider_search_documents"
  USING GIN (lower(coalesce("service_names", '')) gin_trgm_ops);

CREATE INDEX "provider_search_documents_brand_names_trgm_idx"
  ON "provider_search_documents"
  USING GIN (lower(coalesce("brand_names", '')) gin_trgm_ops);

CREATE INDEX "provider_search_documents_search_text_idx"
  ON "provider_search_documents"
  USING GIN (to_tsvector('simple', coalesce("search_text", '')));

ALTER TABLE "service_search_documents" ADD CONSTRAINT "service_search_documents_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_search_documents" ADD CONSTRAINT "brand_search_documents_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_search_documents" ADD CONSTRAINT "provider_search_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

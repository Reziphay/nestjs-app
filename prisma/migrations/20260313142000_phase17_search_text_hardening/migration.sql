CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS services_name_trgm_idx
  ON services
  USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS services_description_trgm_idx
  ON services
  USING GIN (lower(coalesce(description, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS services_text_search_idx
  ON services
  USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS brands_name_trgm_idx
  ON brands
  USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brands_description_trgm_idx
  ON brands
  USING GIN (lower(coalesce(description, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brands_text_search_idx
  ON brands
  USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
  ON users
  USING GIN (lower(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_full_name_text_search_idx
  ON users
  USING GIN (to_tsvector('simple', coalesce(full_name, '')));

CREATE INDEX IF NOT EXISTS service_categories_name_trgm_idx
  ON service_categories
  USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS service_addresses_city_trgm_idx
  ON service_addresses
  USING GIN (lower(city) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS service_addresses_country_trgm_idx
  ON service_addresses
  USING GIN (lower(country) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brand_addresses_city_trgm_idx
  ON brand_addresses
  USING GIN (lower(city) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brand_addresses_country_trgm_idx
  ON brand_addresses
  USING GIN (lower(country) gin_trgm_ops);

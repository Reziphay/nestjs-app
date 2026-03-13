create extension if not exists cube;

create extension if not exists earthdistance;

create index if not exists service_addresses_ll_to_earth_idx
  on service_addresses
  using gist (ll_to_earth(lat, lng))
  where lat is not null and lng is not null;

create index if not exists brand_addresses_primary_ll_to_earth_idx
  on brand_addresses
  using gist (ll_to_earth(lat, lng))
  where is_primary = true
    and lat is not null
    and lng is not null;

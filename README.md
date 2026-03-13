# Reziphay Backend

Current backend foundation for the Reziphay MVP. This app is a NestJS modular monolith with PostgreSQL via Prisma, Redis and BullMQ, Swagger, and the first backend-critical surfaces:

- config and env validation
- Prisma schema and seed data
- phone OTP auth flow
- email verification magic links
- JWT access/refresh sessions with role-aware switching
- user profile and role activation endpoints
- health checks for PostgreSQL and Redis
- brands, memberships, and join requests
- service categories, services, availability, manual blocks, and photo upload base
- reservations, change requests, delay-status updates, manual approval expiration jobs, and completion flows
- reviews, rating stats, in-app notifications, push-token registration, no-show penalties, and objections
- admin moderation, visibility-label management, analytics, and discovery search
- real S3-compatible uploads, real FCM push delivery support, and geolocation provider integration
- appointment reminder jobs plus structured request and job logging with request IDs
- persisted user notification settings for customizable appointment reminder timing
- generic reporting for users, brands, services, and reviews with admin-ready target summaries
- direct nearby-service and service-owner discovery endpoints plus brand-logo uploads

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Redis
- pnpm

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the env template:

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis:

```bash
docker compose up -d
```

4. Generate the Prisma client and apply the checked-in migrations:

```bash
pnpm prisma:generate
pnpm exec prisma migrate deploy
```

5. Seed local data:

```bash
pnpm prisma:seed
```

6. Start the API:

```bash
pnpm dev
```

## Useful commands

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

## API surface through Phase 11

- `POST /api/v1/auth/request-phone-otp`
- `POST /api/v1/auth/verify-phone-otp`
- `POST /api/v1/auth/request-email-magic-link`
- `POST /api/v1/auth/verify-email-magic-link`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/users/me`
- `POST /api/v1/users/me/activate-uso`
- `GET /api/v1/users/me/roles`
- `POST /api/v1/users/me/switch-role`
- `GET /api/v1/users/me/notification-settings`
- `PATCH /api/v1/users/me/notification-settings`
- `GET /api/v1/health`
- `GET /api/v1/brands`
- `POST /api/v1/brands`
- `GET /api/v1/brands/:id`
- `PATCH /api/v1/brands/:id`
- `POST /api/v1/brands/:id/logo`
- `POST /api/v1/brands/:id/join-requests`
- `GET /api/v1/brands/:id/join-requests`
- `POST /api/v1/brands/:id/join-requests/:requestId/accept`
- `POST /api/v1/brands/:id/join-requests/:requestId/reject`
- `POST /api/v1/brands/:id/transfer-ownership`
- `GET /api/v1/brands/:id/members`
- `GET /api/v1/categories`
- `GET /api/v1/services`
- `GET /api/v1/services/nearby`
- `POST /api/v1/services`
- `GET /api/v1/services/:id`
- `PATCH /api/v1/services/:id`
- `DELETE /api/v1/services/:id`
- `PUT /api/v1/services/:id/availability-rules`
- `PUT /api/v1/services/:id/manual-blocks`
- `PUT /api/v1/services/:id/availability-exceptions`
- `GET /api/v1/services/:id/availability`
- `POST /api/v1/services/:id/photos`
- `DELETE /api/v1/services/:id/photos/:photoId`
- `POST /api/v1/reservations`
- `GET /api/v1/reservations/my`
- `GET /api/v1/reservations/incoming`
- `GET /api/v1/reservations/:id`
- `POST /api/v1/reservations/:id/accept`
- `POST /api/v1/reservations/:id/reject`
- `POST /api/v1/reservations/:id/cancel-by-customer`
- `POST /api/v1/reservations/:id/cancel-by-owner`
- `POST /api/v1/reservations/:id/change-requests`
- `POST /api/v1/reservations/change-requests/:id/accept`
- `POST /api/v1/reservations/change-requests/:id/reject`
- `POST /api/v1/reservations/:id/delay-status`
- `POST /api/v1/reservations/:id/complete-manually`
- `POST /api/v1/reservations/:id/complete-by-qr`
- `POST /api/v1/reviews`
- `DELETE /api/v1/reviews/:id`
- `POST /api/v1/reviews/:id/replies`
- `POST /api/v1/reviews/:id/report`
- `GET /api/v1/penalties/me`
- `POST /api/v1/reservations/:id/objections`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/push-tokens`
- `POST /api/v1/reports`
- `GET /api/v1/search`
- `GET /api/v1/service-owners`
- `GET /api/v1/admin/reports`
- `POST /api/v1/admin/reports/:id/resolve`
- `GET /api/v1/admin/reservation-objections`
- `POST /api/v1/admin/reservation-objections/:id/resolve`
- `POST /api/v1/admin/users/:id/suspend`
- `POST /api/v1/admin/users/:id/close`
- `GET /api/v1/admin/visibility-labels`
- `POST /api/v1/admin/visibility-labels`
- `POST /api/v1/admin/visibility-labels/:id/assign`
- `POST /api/v1/admin/visibility-labels/:id/unassign`
- `GET /api/v1/admin/analytics/overview`
- `GET /api/v1/locations/search`
- `GET /api/v1/locations/reverse`

Swagger is exposed at [http://localhost:3000/api/docs](http://localhost:3000/api/docs) when `SWAGGER_ENABLED=true`.

## Seeded accounts

These records are meant for local development only:

- `admin@reziphay.local` / `+10000000001`
- `customer@reziphay.local` / `+10000000002`
- `uso@reziphay.local` / `+10000000003`

Seeded domain data:

- brand: `Studio Reziphay`
- category: `Barber`, `Dentistry`, `Beauty`
- service: `Classic Haircut`
- visibility labels: `featured`, `sponsored`, `vip`

Phone OTP delivery is intentionally stubbed in Phase 1. In non-production environments, the requested OTP or email verification token is returned in the API response so local testing stays fast.

File uploads now run through the storage abstraction with either the local filesystem driver or an S3-compatible driver. Local uploads still write into `.local-storage/uploads` by default.

Manual-approval reservations now use BullMQ with Redis for the 5-minute timeout flow. The queue worker runs inside the same Nest process in local development, so `pnpm dev` is enough as long as Redis is up.

For confirmed reservations, the owner-facing `GET /api/v1/reservations/:id` response includes a short-lived signed QR completion payload that the customer can submit to `POST /api/v1/reservations/:id/complete-by-qr`.

Phase 4 adds recurring BullMQ maintenance for no-show detection and penalty cleanup. Those jobs are also processed inside the same Nest process in local development.

Phase 8 adds delayed BullMQ reminder jobs for confirmed reservations. The default reminder cadence is driven by `RESERVATION_REMINDER_LEAD_MINUTES`, which defaults to `120,30`.

Phase 9 adds per-account reminder preferences for customer flows. If a user has not customized reminder settings yet, the scheduler still falls back to `RESERVATION_REMINDER_LEAD_MINUTES`.

Notifications are always persisted in-app first. If `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY` are configured, the backend also sends real push notifications through Firebase Admin and removes dead tokens when FCM reports them as invalid.

Phase 10 completes the generic complaint flow from the PRD. Clients can now create reports against users, brands, services, and reviews through `POST /api/v1/reports`, and admins receive a moderation-ready target summary when listing reports.

Phase 11 adds customer delay-status updates on confirmed reservations. Owners receive in-app and optional push notifications when a customer reports `RUNNING_LATE` or `ARRIVED`, and the no-show worker now skips reservations already marked as arrived.

Phase 12 exposes the remaining direct discovery surfaces from the brief: `GET /api/v1/services/nearby` for coordinate-based service discovery and `GET /api/v1/service-owners` for provider listings using the same ranking logic as `/api/v1/search`. It also adds multipart `POST /api/v1/brands/:id/logo`, and brand responses now include the resolved `logoFile` metadata when a logo is attached.

Phase 13 adds owner-managed temporary manual blocks for services. `PUT /api/v1/services/:id/manual-blocks` replaces the current block set, `GET /api/v1/services/:id/availability` now returns `manualBlocks` alongside rules and exceptions, and reservation creation or change acceptance now rejects windows that overlap an active manual block.

Phase 14 makes service discovery availability-aware. `GET /api/v1/search` and `GET /api/v1/services/nearby` now accept `requestedStartAt`, optional `requestedEndAt`, and `availableOnly=true`, then evaluate weekly rules, date exceptions, manual blocks, and confirmed `SOLO` reservations before ranking available services first and returning an `availability` snapshot on each service result.

Phase 15 adds explicit discovery sort modes. `sortBy=RELEVANCE|PROXIMITY|RATING|PRICE_LOW|PRICE_HIGH|POPULARITY|AVAILABILITY` is now supported across discovery queries, with reservation-backed popularity ordering for services, brands, and providers. `PRICE_LOW` and `PRICE_HIGH` only affect service result arrays, while `PROXIMITY` requires `lat` and `lng`, and `AVAILABILITY` requires `requestedStartAt`.

Phase 16 hardens popularity sorting for discovery. Search no longer performs live reservation `groupBy` aggregates for popularity ordering; instead it reads denormalized popularity stat tables for services, brands, and providers, and those counters are updated transactionally whenever a reservation enters or leaves the statuses that contribute to discovery popularity.

Phase 17 hardens text discovery for PostgreSQL. When `q` is present, services, brands, and provider listings now use PostgreSQL full-text ranking plus trigram similarity to produce ranked candidate IDs before hydrating the normal Prisma include graph, and the database now enables `pg_trgm` with search-oriented trigram/full-text indexes on the main discovery text columns.

Phase 18 introduces denormalized search documents. Services, brands, and provider profiles now maintain dedicated search-document rows that capture the text discovery layer, those documents are synchronized from the relevant brand/service/role write paths, and ranked discovery queries now read that search-document read model instead of building provider/service text from live aggregation joins.

Phase 19 hardens discovery pagination and geo narrowing. Discovery endpoints now accept an opaque `cursor` and return `pageInfo` metadata, pagination is stabilized with deterministic tie-breaking, and when `lat`, `lng`, and `radiusKm` are provided the search layer now narrows service/brand/provider candidates in the database before the existing in-memory ranking and serialization steps.

Phase 20 adds database-native geo distance support for discovery. PostgreSQL now enables `cube` and `earthdistance`, service and brand addresses have `ll_to_earth` GiST indexes, `/api/v1/services/nearby` and `/api/v1/service-owners` now select candidates with exact SQL distance instead of only application-side sorting, and geo-aware ranked discovery now carries the SQL-computed nearest distance all the way into serialized results so provider distance is no longer inferred from the limited preview arrays.

Phase 5 adds admin moderation APIs, admin audit logging, reusable visibility labels for brands/services/providers, and PostgreSQL-backed discovery search across services, brands, and provider profiles.

For object storage, keep `STORAGE_DRIVER=local` for local filesystem uploads or switch to `STORAGE_DRIVER=s3` and set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and optionally `S3_ENDPOINT` plus `S3_FORCE_PATH_STYLE=true` for S3-compatible providers such as MinIO.

For geolocation, keep `GEO_PROVIDER=none` if you do not want external lookups. To enable real address autocomplete and reverse geocoding, set `GEO_PROVIDER=mapbox` and provide `MAPBOX_ACCESS_TOKEN`. `MAPBOX_BASE_URL`, `MAPBOX_DEFAULT_COUNTRY`, and `MAPBOX_DEFAULT_LANGUAGE` are optional overrides.

HTTP responses now include an `x-request-id` header, and both success and error envelopes include the same `requestId` value when the app is running with the full Nest bootstrap.

# Reziphay Backend

Phase 1 foundation for the Reziphay backend MVP. This app is a NestJS modular monolith with PostgreSQL via Prisma, Redis connectivity, Swagger, and the first backend-critical surfaces:

- config and env validation
- Prisma schema and seed data
- phone OTP auth flow
- email verification magic links
- JWT access/refresh sessions with role-aware switching
- user profile and role activation endpoints
- health checks for PostgreSQL and Redis
- brands, memberships, and join requests
- service categories, services, availability, and photo upload base

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

4. Generate the Prisma client and run the initial migration:

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init_phase1
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

## API surface in Phase 1

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
- `GET /api/v1/health`
- `GET /api/v1/brands`
- `POST /api/v1/brands`
- `GET /api/v1/brands/:id`
- `PATCH /api/v1/brands/:id`
- `POST /api/v1/brands/:id/join-requests`
- `GET /api/v1/brands/:id/join-requests`
- `POST /api/v1/brands/:id/join-requests/:requestId/accept`
- `POST /api/v1/brands/:id/join-requests/:requestId/reject`
- `POST /api/v1/brands/:id/transfer-ownership`
- `GET /api/v1/brands/:id/members`
- `GET /api/v1/categories`
- `GET /api/v1/services`
- `POST /api/v1/services`
- `GET /api/v1/services/:id`
- `PATCH /api/v1/services/:id`
- `DELETE /api/v1/services/:id`
- `PUT /api/v1/services/:id/availability-rules`
- `PUT /api/v1/services/:id/availability-exceptions`
- `GET /api/v1/services/:id/availability`
- `POST /api/v1/services/:id/photos`
- `DELETE /api/v1/services/:id/photos/:photoId`

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

Phone OTP delivery is intentionally stubbed in Phase 1. In non-production environments, the requested OTP or email verification token is returned in the API response so local testing stays fast.

File uploads use the local storage driver in Phase 2 and write into `.local-storage/uploads`. The storage abstraction is in place so this can be replaced with S3-compatible storage later.

# Reziphay Backend

Initial MVP backend setup built with NestJS.

## Requirements

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose

## Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d mysql redis
pnpm prisma:migrate:dev
pnpm start:dev
```

If host ports `3306` or `6379` are already in use, run Docker Compose with port overrides:

```bash
MYSQL_PORT=3307 REDIS_PORT=6380 docker compose up -d mysql redis
```

During first initialization, the MySQL container grants the default `reziphay` user the `CREATE`, `DROP`, and `ALTER` privileges required by Prisma migrations. If you change the database username, update the init SQL file accordingly.

API:

- `http://localhost:3000/api/v1/health`
- `http://localhost:3000/api/docs`

## Scripts

```bash
pnpm start:dev
pnpm build
pnpm lint
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
pnpm test
pnpm test:e2e
```

## Current Scope

- Global env/config loading
- Global validation pipe
- Standard API success/error envelope
- Swagger bootstrap
- Local MySQL + Redis setup with Docker
- Health endpoint
- Prisma schema and initial domain migration setup
# nestjs-app

# Finance Tracker API

Backend for the self-hosted personal finance tracker. Node 20 + Express + Prisma + PostgreSQL.

## Local dev

```bash
cp .env.example .env
# Edit DATABASE_URL and SESSION_SECRET
docker run -d --name ft-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finance -p 5432:5432 postgres:16-alpine
pnpm install
pnpm exec prisma migrate deploy
pnpm dev
```

API listens on `http://localhost:4000`.

## Test / build

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Deploy to Railway

1. Add the PostgreSQL plugin to your Railway project.
2. Create a service from this repo. Railway auto-detects `Dockerfile` (configured via `railway.json`).
3. Set environment variables:
   - `DATABASE_URL` → reference the Postgres plugin's variable
   - `SESSION_SECRET` → 32+ random bytes (`openssl rand -hex 32`)
   - `WEB_ORIGIN=https://<your-web-domain>` (must match the web frontend)
   - `DEFAULT_CURRENCY=USD`
   - `SIGNUP_ENABLED=true` (set to `false` after first user registers)
   - `LOG_LEVEL=info`
4. Healthcheck path: `/api/ready` (already in `railway.json`).
5. Set up a public domain.

## Routes

- `POST /api/auth/token/new` — create new anonymous user, returns token once
- `POST /api/auth/token/login` — login with token
- `POST /api/auth/token/rotate` — rotate token
- `GET  /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/logout`
- `GET/POST/PATCH/DELETE /api/accounts`
- `GET/POST/PATCH/DELETE /api/categories`
- `GET/POST/PATCH/DELETE /api/tags`
- `GET/POST/PATCH/DELETE /api/transactions`
- `GET/POST/PATCH/DELETE /api/budgets`, `GET /api/budgets/progress`
- `GET/POST/PATCH/DELETE /api/recurring`, `POST /api/recurring/:id/run`
- `GET/POST/PATCH/DELETE /api/goals`, `POST /api/goals/:id/contribute`
- `GET /api/reports/summary|cashflow|by-category`, `GET /api/reports/export.csv`
- `POST /api/import/csv`
- `GET /api/health` (liveness), `GET /api/ready` (DB readiness)

## Architecture notes

- Auth: token-only (web3-like). User has a `tokenHash` (sha256 of raw token). The raw token is shown once at creation.
- CSRF: double-submit cookie. Mutating requests need `X-XSRF-TOKEN` header that matches `XSRF-TOKEN` cookie.
- Session: iron-session, httpOnly cookie.
- Money: `Decimal(14,2)` end-to-end. `decimal.js` for math.
- Recurring: `node-cron` hourly, idempotent via `(recurringRuleId, scheduledFor)` unique constraint.

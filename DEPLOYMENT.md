# Production deployment

Monorepo layout:

```
S7-system/
├── backend/                 # NestJS API (global prefix /api)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/      # SQL migrations — apply with `prisma migrate deploy`
│   ├── src/
│   └── .env.example
├── frontend/                # Next.js App Router
│   ├── app/
│   ├── lib/api.ts           # Axios base URL from NEXT_PUBLIC_API_URL
│   └── .env.example
├── DEPLOYMENT.md
└── README.md
```

## Environment variables

### Backend (`backend/.env` or host env)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default **5000** if unset) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `SUPER_ADMIN_ID` | Hardcoded super-admin login ID |
| `SUPER_ADMIN_PASSWORD` | Super-admin password |
| `CORS_ORIGIN` | Comma-separated allowed browser origins (include your **Vercel** URL) |

Copy `backend/.env.example` as a starting point.

### Frontend (Vercel / `.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | API **origin** only (no `/api` path). Example: `https://api.yourdomain.com` or `http://localhost:5000`. The client appends `/api` automatically. |

Copy `frontend/.env.example`.

**Vercel (required or login shows “Cannot reach the server”):**

1. Project → **Settings** → **Environment Variables**.
2. Add **`NEXT_PUBLIC_API_URL`** = your backend base URL, e.g. `https://your-service.onrender.com`  
   - Use **`https://`** if your frontend is HTTPS (mixed HTTP API calls are blocked).
   - Do **not** include `/api` (the app adds it).
3. Apply to **Production** (and Preview if you use preview deploys).
4. **Redeploy** the frontend so the build picks up the variable (Next embeds `NEXT_PUBLIC_*` at build time).

On the login page, the small **API:** line shows which URL the browser will call — use it to confirm configuration.

## Prisma 7 & database schema

| Item | Location |
|------|----------|
| Models (`Business`, `Category`, `Item`, …) | `backend/prisma/schema.prisma` |
| **Connection URL for Migrate / CLI** | `backend/prisma.config.ts` → `process.env.DATABASE_URL` |
| Client output | `backend/generated/prisma` (gitignored; `npm run prisma:generate` or `postinstall`) |

**Run Prisma from `backend/`:** All `npx prisma …` commands and `npm run prisma:*` scripts assume your shell’s current directory is **`backend/`**. If you run them from the monorepo root (`S7 system/`), Prisma reports *Could not find Prisma Schema* because there is no `prisma/schema.prisma` at the repo root.

**Important:** Prisma **7** does **not** allow `url = env("DATABASE_URL")` inside `schema.prisma`. The datasource URL lives in **`prisma.config.ts`** only. The Nest app still reads **`DATABASE_URL`** via `ConfigService` for the `pg` pool — keep the same value in env everywhere.

### npm scripts (`backend/package.json`)

| Script | Purpose |
|--------|---------|
| `npm run prisma:generate` | `prisma generate` |
| `npm run prisma:migrate` | `prisma migrate dev` (creates/applies migrations in **dev**) |
| `npm run prisma:deploy` | `prisma migrate deploy` (applies existing migrations in **prod/CI**) |
| `npm run prisma:validate` | `prisma validate` |
| `npm run start:prod` | Start Nest (`main.ts` runs **`prisma migrate deploy`** before listening) |
| `npm run start:prod:with-migrate` | Same as **`start:prod`** (kept for existing Render configs) |

Initial migration: `prisma/migrations/20260203120000_initial/migration.sql` creates all tables (including **`public.Business`**).

### Local development

```bash
cd backend
cp .env.example .env   # set DATABASE_URL to local Postgres
npm install
npm run prisma:generate
# Create a new migration after model changes:
npm run prisma:migrate -- --name describe_your_change
# Or sync schema without migration history (dev only):
npm run prisma:push
```

### Production (any host)

1. Set **`DATABASE_URL`** (no hardcoded URLs in code).
2. **`npm run prisma:deploy`** once from CI/shell if you need migrations without starting the app, **or** just start the API — **`main.ts` runs `prisma migrate deploy`** on boot when `DATABASE_URL` is set (unless `PRISMA_SKIP_MIGRATE=1`).

Do **not** rely on `prisma db push` in production unless you intentionally avoid Migrate.

### Render.com (Web Service)

Point the service at the **`backend/`** directory (or run commands from there).

| Setting | Example |
|--------|---------|
| **Build command** | `npm ci && npm run build` |
| **Start command** | `npm run start:prod` (or `start:prod:with-migrate` — same) |

On boot, the process runs **`prisma migrate deploy`** (from **`main.ts`**) before Nest accepts traffic, so tables like **`Business`** exist on first deploy. Set **`DATABASE_URL`** to your Render Postgres (Internal or External URL).

To skip programmatic migrate (e.g. unusual hosting), set **`PRISMA_SKIP_MIGRATE=1`** and run **`npx prisma migrate deploy`** yourself before each release.

### Error: `The table public.Business does not exist`

The database is empty — migrations were never applied.

1. Set **`DATABASE_URL`** on the host to your Postgres (must match the DB you intend to use).
2. **Redeploy** the API so a current build runs boot-time **`prisma migrate deploy`** (see `backend/src/main.ts` + `run-migrate-deploy.ts`).
3. Or run **`npx prisma migrate deploy`** once from **`backend/`** against that same URL (Render Shell or your laptop).

## Build & run locally (production mode)

**Backend**

```bash
cd backend
cp .env.example .env   # edit with real secrets and DATABASE_URL
npm ci
npm run build
npm run start:prod
```

(`start:prod` applies migrations on boot; you can still run `npm run prisma:deploy` manually if you prefer.)

Listens on `PORT` (default **5000**). API routes are under `http://<host>:<port>/api/...`.

`npm run start:prod` runs `node dist/src/main.js` (Nest CLI output layout).

**Frontend**

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your API origin
npm ci
npm run build
npm run start
```

## CORS

- **Recommended:** set `CORS_ORIGIN` to your exact frontend origin(s):

  ```env
  CORS_ORIGIN=https://my-app.vercel.app
  ```

- **If you omit `CORS_ORIGIN` on production** (e.g. Render), the API **reflects the browser `Origin`** so Vercel → Render login works without extra config. Logs will show a one-line warning — tighten later with an explicit allowlist.

- **`CORS_ORIGIN=*`** means allow any origin (reflect). Prefer a fixed URL when you can.

Local dev without `NODE_ENV=production` still defaults to `http://localhost:3000`.

## Smoke checks

- `GET http://<API_HOST>:<PORT>/api` — app root (if exposed).
- Log in from the frontend; JWT should be issued and subsequent requests should include `Authorization: Bearer …`.

## Super admin login troubleshooting

1. **Exact variable names** on the API host: `SUPER_ADMIN_ID` and `SUPER_ADMIN_PASSWORD` (case-sensitive names).
2. **Both must be set** — if either is missing, super admin login is disabled (check deploy logs on boot for `Super admin login is configured.` vs the warning).
3. **Login ID field** must match `SUPER_ADMIN_ID` exactly apart from letter case (e.g. `S7-0000` vs `s7-0000` both work). Password must match character-for-character after trimming spaces.
4. **No extra quotes** in the dashboard UI — if you pasted `"mysecret"`, the backend strips one pair of surrounding quotes; prefer entering values without quotes.
5. **Avoid creating a business** whose `uniqueCode` equals your `SUPER_ADMIN_ID` — super admin is checked first, but duplicates cause confusion.
6. After login you should land on **`/admin/dashboard`**. If the API returns `Invalid credentials`, the usual causes are wrong password, unset env vars, or the request hitting a **different** backend instance than the one you configured.

## No mock data

Application data comes from PostgreSQL via Prisma; there is no in-code mock API layer for production features.

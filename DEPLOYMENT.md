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

Copy `frontend/.env.example`. On Vercel, set `NEXT_PUBLIC_API_URL` to your **deployed API origin** before running `npm run build` (Next.js bakes public env vars into the client bundle at build time).

## Database (production)

1. Set `DATABASE_URL` on the API host.
2. Generate Prisma Client (often automatic via `postinstall`):

   ```bash
   cd backend && npx prisma generate
   ```

3. Apply migrations:

   ```bash
   cd backend && npx prisma migrate deploy
   ```

Do **not** use `prisma db push` on production unless you intentionally manage schema outside migrations.

## Build & run locally (production mode)

**Backend**

```bash
cd backend
cp .env.example .env   # edit with real secrets and DATABASE_URL
npm ci
npx prisma migrate deploy
npm run build
npm run start:prod
```

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

Set `CORS_ORIGIN` to every frontend origin that should call the API, for example:

```env
CORS_ORIGIN=https://my-app.vercel.app,http://localhost:3000
```

## Smoke checks

- `GET http://<API_HOST>:<PORT>/api` — app root (if exposed).
- Log in from the frontend; JWT should be issued and subsequent requests should include `Authorization: Bearer …`.

## No mock data

Application data comes from PostgreSQL via Prisma; there is no in-code mock API layer for production features.

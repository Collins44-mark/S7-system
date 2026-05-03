# Hardware Sales & Inventory (SaaS)

Production-oriented monorepo: **Next.js (App Router)** frontend and **NestJS + Prisma + PostgreSQL** backend. Features include unified auth (super admin + business tenants), inventory with restock history, categories, checkout orders, customer debt tracking, receipts, and reports.

**Production checklist:** see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Structure

- `frontend/` — Next.js 15, Tailwind v4, shadcn/ui, Axios, Zustand (persisted JWT)
- `backend/` — NestJS 10, Prisma 7, JWT auth, REST API under `/api`

## Prerequisites

- Node.js 20+
- PostgreSQL database (local, [Supabase](https://supabase.com), or [Render](https://render.com))

## Backend setup (development)

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, SUPER_ADMIN_*, CORS_ORIGIN, PORT (default 5000)
npm install
npx prisma generate
# Dev schema sync (optional): npx prisma db push  OR  npx prisma migrate dev
# Production / Render: use  npx prisma migrate deploy  (see DEPLOYMENT.md)
npm run start:dev
```

API listens on `http://localhost:5000` (or `PORT`) with routes under **`/api`**.

**Production database:** `npx prisma migrate deploy` (see [DEPLOYMENT.md](./DEPLOYMENT.md)).

## Frontend setup (development)

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL = API origin only, e.g. http://localhost:5000 (no /api)
npm install
npm run dev
```

Open `http://localhost:3000`. Sign in with super admin or a business **Login ID** (e.g. `S7-0001`) created from the admin dashboard.

## Deployment (summary)

| Component | Suggested host | Notes |
|-----------|----------------|--------|
| Frontend | Vercel | Set `NEXT_PUBLIC_API_URL` to your **API origin** (scheme + host + port); `/api` is appended in code |
| Backend | Render / Railway / VPS | Set `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_*`, `CORS_ORIGIN` (your Vercel URL), `PORT` |
| Database | Supabase / Neon / managed Postgres | Connection string in `DATABASE_URL` |

Full steps: [DEPLOYMENT.md](./DEPLOYMENT.md).

## API overview

| Area | Routes |
|------|--------|
| Auth | `POST /api/auth/login`, `GET/PATCH /api/auth/me` |
| Admin | `GET/POST /api/admin/businesses`, `PATCH /api/admin/businesses/:id` |
| Categories | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:id` |
| Items | `GET/POST /api/items`, `PATCH/DELETE /api/items/:id`, `POST /api/items/:id/restock` |
| Orders | `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders` |
| Customers | `GET /api/customers` |
| Debts | `GET /api/debts`, `POST /api/debts/:id/pay` |
| Reports | `GET /api/reports/dashboard`, `GET /api/reports/sales`, `GET /api/reports/timeseries`, `GET /api/reports/restocks` |

All routes except `auth/login` require `Authorization: Bearer <JWT>`.

## Business rules (backend)

- **Profit per unit** is derived as `sellingPrice - buyingPrice` (also stored per line on orders as `lineProfit`).
- **Checkout** decreases stock; insufficient quantity returns `400`.
- If **amount paid &lt; total**, a **Debt** row is created for the order balance; partial payments update order totals and debt until settled.
- **Restocks** append `RestockLog` rows and increment item quantity.

## License

Private / your stack — adjust as needed.

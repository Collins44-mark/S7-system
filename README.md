# Hardware Sales & Inventory (SaaS)

Production-oriented monorepo: **Next.js (App Router)** frontend and **NestJS + Prisma + PostgreSQL** backend. Features include auth, inventory with restock history, categories, multi-step checkout orders, automatic stock reduction, customer debt tracking, receipts, and reports.

## Structure

- `frontend/` — Next.js 15, Tailwind v4, shadcn/ui, Axios, Zustand (persisted JWT)
- `backend/` — NestJS 10, Prisma 7, JWT auth, REST API under `/api`

## Prerequisites

- Node.js 20+
- PostgreSQL database (local, [Supabase](https://supabase.com), or [Render](https://render.com))

## Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

API listens on `http://localhost:3001` with routes prefixed by **`/api`** (e.g. `POST http://localhost:3001/api/auth/login`).

**Render / CI:** the Prisma client is generated into `backend/generated/prisma` (gitignored). Your build command should include `npx prisma generate` before `nest build`.

### Useful scripts

- `npm run prisma:push` — apply schema to the database (dev)
- `npm run prisma:migrate` — create/apply migrations (`prisma migrate dev`)
- `npm run prisma:generate` — regenerate Prisma Client

## Frontend setup

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your API, e.g. http://localhost:3001/api
npm install
npm run dev
```

Open `http://localhost:3000`. Register a user, then use the sidebar for Dashboard, Inventory, Categories, Orders, Customers (debts), Reports, and Settings.

## Deployment

| Component  | Suggested host | Notes |
|-----------|----------------|--------|
| Frontend  | Vercel         | Set `NEXT_PUBLIC_API_URL` to your Render API URL + `/api` |
| Backend   | Render         | Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel domain) |
| Database  | Supabase / Render Postgres | Use connection string in `DATABASE_URL` |

Ensure `CORS_ORIGIN` on the backend includes your exact Vercel origin (e.g. `https://your-app.vercel.app`).

## API overview

| Area | Routes |
|------|--------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me` |
| Categories | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:id` |
| Items | `GET/POST /api/items`, `PATCH/DELETE /api/items/:id`, `POST /api/items/:id/restock` |
| Orders | `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders` |
| Customers | `GET /api/customers` |
| Debts | `GET /api/debts`, `POST /api/debts/:id/pay` |
| Reports | `GET /api/reports/dashboard`, `GET /api/reports/sales`, `GET /api/reports/timeseries`, `GET /api/reports/restocks` |

All routes except `auth/register` and `auth/login` require `Authorization: Bearer <JWT>`.

## Business rules (backend)

- **Profit per unit** is derived as `sellingPrice - buyingPrice` (also stored per line on orders as `lineProfit`).
- **Checkout** decreases stock; insufficient quantity returns `400`.
- If **amount paid &lt; total**, a **Debt** row is created for the order balance; partial payments update order totals and debt until settled.
- **Restocks** append `RestockLog` rows and increment item quantity.

## License

Private / your stack — adjust as needed.

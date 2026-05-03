/**
 * Prisma 7 — datasource URL for Migrate / CLI lives here (not in schema.prisma).
 * Set DATABASE_URL on the host (e.g. Render → Web Service + Postgres env vars).
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

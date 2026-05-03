/**
 * Single import path for Prisma types/enums so feature code does not deep-link
 * into `generated/` (avoids broken relative paths and simplifies CI: run `prisma generate` once).
 */
export { PrismaClient, Prisma } from '../../generated/prisma/client';
export {
  OrderStatus,
  DebtStatus,
  PaymentMethod,
} from '../../generated/prisma/enums';

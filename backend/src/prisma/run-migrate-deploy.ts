import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '@nestjs/common';

function resolveBackendRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, '..', '..', '..'), // dist/src/prisma -> backend
    path.resolve(__dirname, '..', '..'), // src/prisma (ts) -> backend
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'prisma', 'schema.prisma'))) {
      return dir;
    }
  }
  return process.cwd();
}

/**
 * Ensures `prisma migrate deploy` runs against DATABASE_URL before the app
 * serves traffic — fixes empty DBs (e.g. Render) when the start command omitted migrate.
 */
export function runPrismaMigrateDeploy(logger: Logger): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (process.env.PRISMA_SKIP_MIGRATE === '1') {
    logger.log('PRISMA_SKIP_MIGRATE=1 — skipping prisma migrate deploy');
    return;
  }
  if (!process.env.DATABASE_URL) {
    logger.warn(
      'DATABASE_URL is unset — skipping prisma migrate deploy (expected in tests only).',
    );
    return;
  }

  const backendRoot = resolveBackendRoot();
  let prismaMain: string;
  try {
    prismaMain = require.resolve('prisma/build/index.js', {
      paths: [backendRoot],
    });
  } catch {
    logger.warn(
      'Could not resolve prisma CLI — skipping migrate deploy. Run `npx prisma migrate deploy` from backend/ if tables are missing.',
    );
    return;
  }

  logger.log('Applying database migrations (prisma migrate deploy)...');
  execFileSync(process.execPath, [prismaMain, 'migrate', 'deploy'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
  logger.log('Database migrations are up to date.');
}

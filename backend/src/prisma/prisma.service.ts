import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated-imports';
import { Pool } from 'pg';

const CONNECT_RETRIES = 12;
const CONNECT_DELAY_MS = 1000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  /**
   * Render Postgres can be a few seconds behind on cold start; retry connects
   * so the app does not exit immediately while the DB accepts connections.
   */
  async onModuleInit() {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Database connected after ${attempt} attempts`);
        } else {
          this.logger.log('Database connection established');
        }
        return;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Prisma $connect failed (${attempt}/${CONNECT_RETRIES}): ${msg}`,
        );
        if (attempt < CONNECT_RETRIES) {
          await new Promise((r) => setTimeout(r, CONNECT_DELAY_MS));
        }
      }
    }
    this.logger.error(
      'Database unavailable after retries. Check DATABASE_URL, network, and that migrations were applied (npx prisma migrate deploy).',
    );
    throw lastError;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

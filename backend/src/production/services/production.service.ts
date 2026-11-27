import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated-imports';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { CreateProductionDto } from '../dto/create-production.dto';
import { ProductionRepository } from '../repositories/production.repository';

function present(row: {
  id: string;
  sourceQuantity: Prisma.Decimal;
  sourceQuantityAfter: Prisma.Decimal;
  resultQuantity: Prisma.Decimal;
  resultQuantityAfter: Prisma.Decimal;
  createdAt: Date;
  sourceItem: { id: string; name: string; unit: string };
  resultItem: { id: string; name: string; unit: string };
}) {
  return {
    id: row.id,
    sourceQuantity: row.sourceQuantity.toString(),
    sourceQuantityAfter: row.sourceQuantityAfter.toString(),
    resultQuantity: row.resultQuantity.toString(),
    resultQuantityAfter: row.resultQuantityAfter.toString(),
    createdAt: row.createdAt.toISOString(),
    sourceItem: row.sourceItem,
    resultItem: row.resultItem,
  };
}

@Injectable()
export class ProductionService {
  constructor(private readonly production: ProductionRepository) {}

  async list(user: BusinessPrincipal, from?: string, to?: string) {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Choose a date range.');
    }
    const rows = await this.production.list(user.sub, start, end);
    return rows.map(present);
  }

  async create(user: BusinessPrincipal, body: CreateProductionDto) {
    if (body.sourceItemId === body.resultItemId) {
      throw new BadRequestException('PRODUCTION_SAME_ITEM');
    }
    try {
      const row = await this.production.transform({
        businessId: user.sub,
        sourceItemId: body.sourceItemId,
        sourceQuantity: new Prisma.Decimal(body.sourceQuantity),
        resultItemId: body.resultItemId,
        resultQuantity: new Prisma.Decimal(body.resultQuantity),
      });
      return present(row);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (
        code === 'PRODUCTION_ITEM_MISSING' ||
        code === 'PRODUCTION_SAME_ITEM' ||
        code === 'PRODUCTION_NOT_ENOUGH'
      ) {
        throw new BadRequestException(code);
      }
      throw error;
    }
  }
}

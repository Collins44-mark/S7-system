import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../prisma/generated-imports';

const itemPick = { id: true, name: true, unit: true } as const;

@Injectable()
export class ProductionRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string, start: Date, end: Date) {
    return this.prisma.production.findMany({
      where: {
        businessId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        sourceItem: { select: itemPick },
        resultItem: { select: itemPick },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  transform(params: {
    businessId: string;
    sourceItemId: string;
    sourceQuantity: Prisma.Decimal;
    resultItemId: string;
    resultQuantity: Prisma.Decimal;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.item.findFirst({
        where: { id: params.sourceItemId, businessId: params.businessId },
      });
      const result = await tx.item.findFirst({
        where: { id: params.resultItemId, businessId: params.businessId },
      });
      if (!source || !result) {
        throw new Error('PRODUCTION_ITEM_MISSING');
      }
      if (source.id === result.id) {
        throw new Error('PRODUCTION_SAME_ITEM');
      }
      if (source.quantity.lt(params.sourceQuantity)) {
        throw new Error('PRODUCTION_NOT_ENOUGH');
      }
      const sourceAfter = source.quantity.sub(params.sourceQuantity);
      const resultAfter = result.quantity.add(params.resultQuantity);
      await tx.item.update({
        where: { id: source.id },
        data: { quantity: sourceAfter },
      });
      await tx.item.update({
        where: { id: result.id },
        data: { quantity: resultAfter },
      });
      return tx.production.create({
        data: {
          businessId: params.businessId,
          sourceItemId: source.id,
          sourceQuantity: params.sourceQuantity,
          sourceQuantityAfter: sourceAfter,
          resultItemId: result.id,
          resultQuantity: params.resultQuantity,
          resultQuantityAfter: resultAfter,
        },
        include: {
          sourceItem: { select: itemPick },
          resultItem: { select: itemPick },
        },
      });
    });
  }
}

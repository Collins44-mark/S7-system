import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../prisma/generated-imports';

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllWithCategory(businessId: string, categoryId?: string) {
    return this.prisma.item.findMany({
      where: {
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  findOwned(businessId: string, itemId: string) {
    return this.prisma.item.findFirst({
      where: { id: itemId, businessId },
    });
  }

  findCategoryOwned(businessId: string, categoryId: string) {
    return this.prisma.category.findFirst({
      where: { id: categoryId, businessId },
    });
  }

  create(data: {
    businessId: string;
    name: string;
    unit: string;
    categoryId: string;
    buyingPrice: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
    quantity: Prisma.Decimal;
    lowStockThreshold: Prisma.Decimal;
  }) {
    return this.prisma.item.create({
      data,
      include: { category: true },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      unit?: string;
      categoryId?: string;
      buyingPrice?: Prisma.Decimal;
      sellingPrice?: Prisma.Decimal;
      quantity?: Prisma.Decimal;
      lowStockThreshold?: Prisma.Decimal;
    },
  ) {
    return this.prisma.item.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  delete(id: string) {
    return this.prisma.item.delete({ where: { id } });
  }

  restockBatch(params: {
    businessId: string;
    notes: string | null;
    lines: { itemId: string; quantity: Prisma.Decimal }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.update({
        where: { id: params.businessId },
        data: { lastRestockSequence: { increment: 1 } },
        select: { lastRestockSequence: true },
      });
      const restock = await tx.restock.create({
        data: {
          businessId: params.businessId,
          sequence: business.lastRestockSequence,
          notes: params.notes,
        },
      });
      for (const line of params.lines) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, businessId: params.businessId },
        });
        if (!item) {
          throw new Error('ITEM_NOT_FOUND');
        }
        const before = item.quantity;
        const after = before.add(line.quantity);
        await tx.restockLog.create({
          data: {
            restockId: restock.id,
            itemId: item.id,
            businessId: params.businessId,
            quantity: line.quantity,
            quantityBefore: before,
            quantityAfter: after,
            notes: params.notes,
          },
        });
        await tx.item.update({
          where: { id: item.id },
          data: { quantity: after },
        });
      }
      const updated = await tx.item.findFirst({
        where: { id: params.lines[0]?.itemId, businessId: params.businessId },
        include: { category: true },
      });
      return { restockId: restock.id, sequence: restock.sequence, item: updated };
    });
  }
}

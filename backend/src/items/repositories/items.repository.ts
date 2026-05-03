import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllWithCategory(businessId: string) {
    return this.prisma.item.findMany({
      where: { businessId },
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
    categoryId: string;
    buyingPrice: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
    quantity: number;
    lowStockThreshold: number;
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
      categoryId?: string;
      buyingPrice?: Prisma.Decimal;
      sellingPrice?: Prisma.Decimal;
      quantity?: number;
      lowStockThreshold?: number;
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

  restockWithLog(params: {
    itemId: string;
    businessId: string;
    quantity: number;
    notes: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.restockLog.create({
        data: {
          itemId: params.itemId,
          quantity: params.quantity,
          notes: params.notes,
          businessId: params.businessId,
        },
      });
      return tx.item.update({
        where: { id: params.itemId },
        data: { quantity: { increment: params.quantity } },
        include: { category: true },
      });
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated-imports';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string, start: Date, end: Date) {
    return this.prisma.expense.findMany({
      where: {
        businessId,
        spentAt: { gte: start, lte: end },
      },
      orderBy: { spentAt: 'desc' },
      select: {
        id: true,
        amount: true,
        note: true,
        spentAt: true,
      },
    });
  }

  create(
    businessId: string,
    data: { amount: Prisma.Decimal; note: string | null; spentAt: Date },
  ) {
    return this.prisma.expense.create({
      data: { businessId, ...data },
      select: {
        id: true,
        amount: true,
        note: true,
        spentAt: true,
      },
    });
  }

  remove(businessId: string, id: string) {
    return this.prisma.expense.deleteMany({
      where: { id, businessId },
    });
  }

  findOne(businessId: string, id: string) {
    return this.prisma.expense.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        amount: true,
        note: true,
        spentAt: true,
      },
    });
  }

  update(
    id: string,
    data: { amount?: Prisma.Decimal; note?: string | null },
  ) {
    return this.prisma.expense.update({
      where: { id },
      data,
      select: {
        id: true,
        amount: true,
        note: true,
        spentAt: true,
      },
    });
  }
}

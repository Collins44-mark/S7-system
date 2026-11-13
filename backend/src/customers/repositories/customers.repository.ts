import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, type PaymentMethod } from '../../prisma/generated-imports';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForBusiness(businessId: string) {
    return this.prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  findAccounts(businessId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.mergeSameNames(tx, businessId);
      return tx.customer.findMany({
        where: {
          businessId,
          OR: [
            { creditBalance: { gt: 0 } },
            { accountEntries: { some: {} } },
          ],
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  findReceipts(businessId: string, customerId: string) {
    return this.prisma.order.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        orderItems: { include: { item: true } },
      },
    });
  }

  findAccountEntries(businessId: string, customerId: string) {
    return this.prisma.accountEntry.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * One person is one account. Rows that share a name are folded into the
   * oldest row so a later deposit cannot show up as a second balance.
   */
  private async mergeSameNames(
    tx: Prisma.TransactionClient,
    businessId: string,
  ) {
    const rows = await tx.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...rest] = group;
      let extra = new Prisma.Decimal(0);
      for (const dup of rest) {
        extra = extra.add(dup.creditBalance);
        await tx.order.updateMany({
          where: { customerId: dup.id },
          data: { customerId: keep.id },
        });
        await tx.debt.updateMany({
          where: { customerId: dup.id },
          data: { customerId: keep.id },
        });
        await tx.accountEntry.updateMany({
          where: { customerId: dup.id },
          data: { customerId: keep.id },
        });
        await tx.customer.delete({ where: { id: dup.id } });
      }
      if (extra.gt(0)) {
        await tx.customer.update({
          where: { id: keep.id },
          data: { creditBalance: { increment: extra } },
        });
      }
    }
  }

  deposit(params: {
    businessId: string;
    customerId?: string;
    name: string;
    phone: string;
    amount: Prisma.Decimal;
    method: PaymentMethod;
    note: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.mergeSameNames(tx, params.businessId);
      const name = params.name.trim();
      const phone = params.phone.trim();
      let customer = params.customerId
        ? await tx.customer.findFirst({
            where: { id: params.customerId, businessId: params.businessId },
          })
        : null;
      if (!customer) {
        customer = await tx.customer.findUnique({
          where: {
            businessId_phone: { businessId: params.businessId, phone },
          },
        });
      }
      if (!customer) {
        customer = await tx.customer.findFirst({
          where: {
            businessId: params.businessId,
            name: { equals: name, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            businessId: params.businessId,
            name,
            phone,
          },
        });
      }
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { creditBalance: { increment: params.amount } },
      });
      await tx.accountEntry.create({
        data: {
          customerId: customer.id,
          businessId: params.businessId,
          amount: params.amount,
          balanceAfter: updated.creditBalance,
          kind: 'DEPOSIT',
          method: params.method,
          note: params.note,
        },
      });
      return updated;
    });
  }
}

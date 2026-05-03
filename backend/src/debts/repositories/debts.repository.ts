import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DebtStatus,
  OrderStatus,
  Prisma,
  type PaymentMethod as PM,
} from '../../prisma/generated-imports';
import type { PayDebtDto } from '../dto/pay-debt.dto';

@Injectable()
export class DebtsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpenForBusiness(businessId: string) {
    return this.prisma.debt.findMany({
      where: {
        status: DebtStatus.OPEN,
        customer: { businessId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        order: {
          include: {
            orderItems: { include: { item: true } },
            payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
  }

  payDebtTransaction(
    businessId: string,
    debtId: string,
    dto: PayDebtDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: {
          id: debtId,
          status: DebtStatus.OPEN,
          customer: { businessId },
        },
        include: { order: true },
      });
      if (!debt) {
        return null;
      }

      const remaining = new Prisma.Decimal(debt.amount.toString());
      const payAmount =
        dto.amount != null
          ? new Prisma.Decimal(String(dto.amount))
          : remaining;

      if (payAmount.lte(0)) {
        throw new Error('INVALID_DEBT_AMOUNT');
      }
      if (payAmount.gt(remaining)) {
        throw new Error('DEBT_PAYMENT_EXCEEDS_BALANCE');
      }

      const newDebtAmt = remaining.sub(payAmount);
      const order = debt.order;
      const newBalance = new Prisma.Decimal(order.balance.toString()).sub(
        payAmount,
      );
      const newAmountPaid = new Prisma.Decimal(
        order.amountPaid.toString(),
      ).add(payAmount);

      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: payAmount,
          method: dto.paymentMethod as PM,
          businessId,
          note: 'Debt payment',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newBalance.lte(0)
            ? OrderStatus.COMPLETED
            : OrderStatus.PENDING,
        },
      });

      if (newDebtAmt.lte(0)) {
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            amount: new Prisma.Decimal(0),
            status: DebtStatus.SETTLED,
            settledAt: new Date(),
          },
        });
      } else {
        await tx.debt.update({
          where: { id: debt.id },
          data: { amount: newDebtAmt },
        });
      }

      return tx.debt.findFirstOrThrow({
        where: { id: debt.id },
        include: {
          customer: true,
          order: true,
        },
      });
    });
  }
}

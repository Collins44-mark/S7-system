import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DebtStatus,
  OrderStatus,
  type PaymentMethod as PM,
  Prisma,
} from '../../prisma/generated-imports';
import { CheckoutError } from '../../core/errors/checkout.errors';
import type { CreateOrderDto } from '../dto/create-order.dto';

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForBusiness(businessId: string) {
    return this.prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        orderItems: { include: { item: true } },
        debt: true,
      },
    });
  }

  findOneForBusiness(businessId: string, orderId: string) {
    return this.prisma.order.findFirst({
      where: { id: orderId, businessId },
      include: {
        customer: true,
        orderItems: { include: { item: true } },
        payments: true,
        debt: true,
      },
    });
  }

  /**
   * Atomic checkout: stock deduction, order, payment, optional debt.
   */
  createCheckoutTransaction(businessId: string, dto: CreateOrderDto) {
    const lines = dto.items;

    return this.prisma.$transaction(async (tx) => {
      const phone = dto.customerPhone?.trim() || null;
      const name = dto.customerName.trim();
      let customer = phone
        ? await tx.customer.findUnique({
            where: { businessId_phone: { businessId, phone } },
          })
        : null;
      if (customer) {
        if (customer.name !== name) {
          customer = await tx.customer.update({
            where: { id: customer.id },
            data: { name },
          });
        }
      } else if (!phone) {
        customer = await tx.customer.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (!customer) {
          customer = await tx.customer.create({
            data: { businessId, name, phone: null },
          });
        }
      } else {
        const sameName = await tx.customer.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: 'insensitive' },
            phone: null,
          },
          orderBy: { createdAt: 'asc' },
        });
        customer = sameName
          ? await tx.customer.update({
              where: { id: sameName.id },
              data: { phone },
            })
          : await tx.customer.create({
              data: { businessId, name, phone },
            });
      }

      let total = new Prisma.Decimal(0);
      const prepared: {
        item: {
          id: string;
          name: string;
          buyingPrice: Prisma.Decimal;
          sellingPrice: Prisma.Decimal;
          quantity: Prisma.Decimal;
        };
        quantity: Prisma.Decimal;
        unitBuy: Prisma.Decimal;
        unitSell: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        lineProfit: Prisma.Decimal;
      }[] = [];

      for (const line of lines) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, businessId },
        });
        if (!item) {
          throw new CheckoutError(
            'Item not found',
            'ITEM_NOT_FOUND',
            line.itemId,
          );
        }
        const lineQty = new Prisma.Decimal(String(line.quantity));
        if (item.quantity.lt(lineQty)) {
          throw new CheckoutError(
            `Insufficient stock for ${item.name}`,
            'INSUFFICIENT_STOCK',
            item.name,
          );
        }
        const unitBuy = new Prisma.Decimal(item.buyingPrice.toString());
        const unitSell = new Prisma.Decimal(item.sellingPrice.toString());
        const lineTotal = unitSell.mul(lineQty);
        const lineProfit = unitSell.sub(unitBuy).mul(lineQty);
        total = total.add(lineTotal);
        prepared.push({
          item,
          quantity: lineQty,
          unitBuy,
          unitSell,
          lineTotal,
          lineProfit,
        });
      }

      const amountPaid = new Prisma.Decimal(String(dto.amountPaid));
      if (amountPaid.gt(total)) {
        throw new CheckoutError(
          'Amount paid cannot exceed order total',
          'AMOUNT_EXCEEDS_TOTAL',
        );
      }

      const balance = total.sub(amountPaid);
      if (balance.gt(0) && !phone && !customer.phone) {
        throw new CheckoutError(
          'Enter a phone number when the payment is not complete',
          'PHONE_REQUIRED',
        );
      }
      const status: OrderStatus = balance.lte(0)
        ? OrderStatus.COMPLETED
        : OrderStatus.PENDING;

      let accountBalanceAfter: Prisma.Decimal | null = null;
      if (dto.paymentMethod === 'ACCOUNT') {
        if (amountPaid.lte(0)) {
          throw new CheckoutError(
            'Enter an amount to take from the account',
            'INSUFFICIENT_ACCOUNT',
          );
        }
        const taken = await tx.customer.updateMany({
          where: {
            id: customer.id,
            creditBalance: { gte: amountPaid },
          },
          data: { creditBalance: { decrement: amountPaid } },
        });
        if (taken.count !== 1) {
          throw new CheckoutError(
            'Not enough money on this account',
            'INSUFFICIENT_ACCOUNT',
          );
        }
        const after = await tx.customer.findUniqueOrThrow({
          where: { id: customer.id },
          select: { creditBalance: true },
        });
        accountBalanceAfter = after.creditBalance;
      }

      const bizSeq = await tx.business.update({
        where: { id: businessId },
        data: {
          lastReceiptSequence: { increment: 1 },
          lastOrderSequence: { increment: 1 },
        },
        select: { lastReceiptSequence: true, lastOrderSequence: true },
      });
      const orderNumber = `ORD-${String(bizSeq.lastOrderSequence).padStart(3, '0')}`;
      const receiptNumber = `RCT-${String(bizSeq.lastReceiptSequence).padStart(3, '0')}`;

      const order = await tx.order.create({
        data: {
          businessId,
          customerId: customer.id,
          orderNumber,
          receiptNumber,
          totalAmount: total,
          amountPaid,
          balance,
          paymentMethod: dto.paymentMethod as PM,
          status,
          orderItems: {
            create: prepared.map((p) => ({
              itemId: p.item.id,
              quantity: p.quantity,
              unitBuyPrice: p.unitBuy,
              unitSellPrice: p.unitSell,
              lineTotal: p.lineTotal,
              lineProfit: p.lineProfit,
            })),
          },
        },
      });

      for (const p of prepared) {
        await tx.item.update({
          where: { id: p.item.id },
          data: { quantity: { decrement: p.quantity } },
        });
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: amountPaid,
          method: dto.paymentMethod as PM,
          businessId,
          note: 'Order checkout',
        },
      });

      if (balance.gt(0)) {
        await tx.debt.create({
          data: {
            orderId: order.id,
            customerId: customer.id,
            amount: balance,
            status: DebtStatus.OPEN,
          },
        });
      }

      if (accountBalanceAfter !== null) {
        await tx.accountEntry.create({
          data: {
            customerId: customer.id,
            businessId,
            orderId: order.id,
            amount: amountPaid.neg(),
            balanceAfter: accountBalanceAfter,
            kind: 'PURCHASE',
            method: 'ACCOUNT',
            note: 'Sale',
          },
        });
      }

      return tx.order.findFirstOrThrow({
        where: { id: order.id },
        include: {
          customer: true,
          orderItems: { include: { item: true } },
          payments: true,
          debt: true,
        },
      });
    });
  }
}

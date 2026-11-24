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
import type { UpdateOrderDto } from '../dto/update-order.dto';

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

      const otherCharges = new Prisma.Decimal(String(dto.otherCharges ?? 0));
      total = total.add(otherCharges);

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
          otherCharges,
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

  /**
   * Correct a confirmed order while keeping its original payment history intact.
   * Inventory is adjusted by the difference between the old and new item quantities.
   */
  updateCheckoutTransaction(
    businessId: string,
    orderId: string,
    dto: UpdateOrderDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, businessId },
        include: { customer: true, orderItems: true, payments: true },
      });
      if (!order) return null;
      if (order.status === OrderStatus.CANCELLED) {
        throw new CheckoutError(
          'Cancelled orders cannot be edited',
          'ORDER_CANCELLED',
        );
      }

      const requestedItemIds = dto.items.map((line) => line.itemId);
      if (new Set(requestedItemIds).size !== requestedItemIds.length) {
        throw new CheckoutError(
          'Each item can appear only once in an order',
          'DUPLICATE_ORDER_ITEM',
        );
      }

      const existingLines = new Map(
        order.orderItems.map((line) => [line.itemId, line]),
      );
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
        previousQuantity: Prisma.Decimal;
      }[] = [];
      let itemsTotal = new Prisma.Decimal(0);

      for (const line of dto.items) {
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
        const quantity = new Prisma.Decimal(String(line.quantity));
        const previous = existingLines.get(item.id);
        const previousQuantity = previous
          ? new Prisma.Decimal(previous.quantity.toString())
          : new Prisma.Decimal(0);
        const stockNeeded = quantity.sub(previousQuantity);
        if (stockNeeded.gt(0) && item.quantity.lt(stockNeeded)) {
          throw new CheckoutError(
            `Insufficient stock for ${item.name}`,
            'INSUFFICIENT_STOCK',
            item.name,
          );
        }

        // Preserve the recorded price for an existing receipt line; use current prices only for new items.
        const unitBuy = new Prisma.Decimal(
          previous
            ? previous.unitBuyPrice.toString()
            : item.buyingPrice.toString(),
        );
        const unitSell = new Prisma.Decimal(
          previous
            ? previous.unitSellPrice.toString()
            : item.sellingPrice.toString(),
        );
        const lineTotal = unitSell.mul(quantity);
        const lineProfit = unitSell.sub(unitBuy).mul(quantity);
        itemsTotal = itemsTotal.add(lineTotal);
        prepared.push({
          item,
          quantity,
          unitBuy,
          unitSell,
          lineTotal,
          lineProfit,
          previousQuantity,
        });
      }

      const otherCharges =
        dto.otherCharges == null
          ? order.otherCharges
          : new Prisma.Decimal(String(dto.otherCharges));
      const total = itemsTotal.add(otherCharges);
      const checkoutPayment =
        order.payments.find((payment) => payment.note === 'Order checkout') ??
        order.payments[0];
      if (!checkoutPayment) {
        throw new CheckoutError(
          'The original order payment could not be found',
          'AMOUNT_BELOW_RECORDED_PAYMENTS',
        );
      }
      const laterPayments = order.payments.reduce(
        (sum, payment) =>
          payment.id === checkoutPayment.id
            ? sum
            : sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      const amountPaid = new Prisma.Decimal(
        String(dto.amountPaid ?? order.amountPaid),
      );
      if (amountPaid.lt(laterPayments)) {
        throw new CheckoutError(
          'Amount paid cannot be lower than payments already recorded later',
          'AMOUNT_BELOW_RECORDED_PAYMENTS',
        );
      }
      if (amountPaid.gt(total)) {
        throw new CheckoutError(
          'Order total cannot be lower than the amount already paid',
          'AMOUNT_EXCEEDS_TOTAL',
        );
      }

      const balance = total.sub(amountPaid);
      const phone =
        dto.customerPhone === undefined
          ? order.customer.phone
          : dto.customerPhone.trim() || null;
      const name = dto.customerName?.trim() || order.customer.name;
      if (balance.gt(0) && !phone) {
        throw new CheckoutError(
          'A phone number is required when the updated order has a balance',
          'PHONE_REQUIRED',
        );
      }
      if (name !== order.customer.name || phone !== order.customer.phone) {
        if (phone && phone !== order.customer.phone) {
          const taken = await tx.customer.findUnique({
            where: { businessId_phone: { businessId, phone } },
          });
          if (taken && taken.id !== order.customerId) {
            throw new CheckoutError(
              'This phone number is already used by another customer',
              'PHONE_IN_USE',
            );
          }
        }
        await tx.customer.update({
          where: { id: order.customerId },
          data: { name, phone },
        });
      }

      const updatedCheckoutAmount = amountPaid.sub(laterPayments);
      const checkoutAdjustment = updatedCheckoutAmount.sub(
        checkoutPayment.amount,
      );
      if (!checkoutAdjustment.isZero() && order.paymentMethod === 'ACCOUNT') {
        if (checkoutAdjustment.gt(0)) {
          const taken = await tx.customer.updateMany({
            where: {
              id: order.customerId,
              creditBalance: { gte: checkoutAdjustment },
            },
            data: { creditBalance: { decrement: checkoutAdjustment } },
          });
          if (taken.count !== 1) {
            throw new CheckoutError(
              'Not enough money on this account',
              'INSUFFICIENT_ACCOUNT',
            );
          }
        } else {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { creditBalance: { increment: checkoutAdjustment.neg() } },
          });
        }
        const customer = await tx.customer.findUniqueOrThrow({
          where: { id: order.customerId },
          select: { creditBalance: true },
        });
        await tx.accountEntry.updateMany({
          where: { orderId: order.id, kind: 'PURCHASE' },
          data: {
            amount: updatedCheckoutAmount.neg(),
            balanceAfter: customer.creditBalance,
          },
        });
      }
      if (!checkoutAdjustment.isZero()) {
        await tx.payment.update({
          where: { id: checkoutPayment.id },
          data: { amount: updatedCheckoutAmount },
        });
      }

      for (const line of order.orderItems) {
        if (!requestedItemIds.includes(line.itemId)) {
          await tx.item.update({
            where: { id: line.itemId },
            data: { quantity: { increment: line.quantity } },
          });
        }
      }
      for (const p of prepared) {
        const change = p.quantity.sub(p.previousQuantity);
        if (!change.isZero()) {
          await tx.item.update({
            where: { id: p.item.id },
            data: change.gt(0)
              ? { quantity: { decrement: change } }
              : { quantity: { increment: change.neg() } },
          });
        }
      }

      const status: OrderStatus = balance.lte(0)
        ? OrderStatus.COMPLETED
        : OrderStatus.PENDING;
      await tx.order.update({
        where: { id: order.id },
        data: {
          totalAmount: total,
          amountPaid,
          balance,
          otherCharges,
          status,
          orderItems: {
            deleteMany: {},
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

      const debt = await tx.debt.findUnique({ where: { orderId: order.id } });
      if (balance.gt(0)) {
        if (debt) {
          await tx.debt.update({
            where: { id: debt.id },
            data: { amount: balance, status: DebtStatus.OPEN, settledAt: null },
          });
        } else {
          await tx.debt.create({
            data: {
              orderId: order.id,
              customerId: order.customerId,
              amount: balance,
              status: DebtStatus.OPEN,
            },
          });
        }
      } else if (debt) {
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            amount: new Prisma.Decimal(0),
            status: DebtStatus.SETTLED,
            settledAt: new Date(),
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

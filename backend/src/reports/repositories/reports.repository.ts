import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma, PrismaClient } from '../../prisma/generated-imports';
import type { ReportPeriod } from '../types/report-period';

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  rangeForPeriod(period: ReportPeriod): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end);
    if (period === 'daily') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    return { start, end };
  }

  findItemsForDashboard(businessId: string) {
    return this.prisma.item.findMany({
      where: { businessId },
      select: {
        quantity: true,
        buyingPrice: true,
        sellingPrice: true,
        lowStockThreshold: true,
      },
    });
  }

  aggregateProfitAllTime(businessId: string) {
    return this.prisma.orderItem.aggregate({
      where: {
        order: {
          businessId,
          status: { not: OrderStatus.CANCELLED },
        },
      },
      _sum: { lineProfit: true },
    });
  }

  findRecentOrders(businessId: string, take: number) {
    return this.prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { customer: true },
    });
  }

  aggregateSales(orderWhere: Prisma.OrderWhereInput) {
    return this.prisma.order.aggregate({
      where: orderWhere,
      _sum: { totalAmount: true },
    });
  }

  aggregateOrderItemsForOrders(orderWhere: Prisma.OrderWhereInput) {
    return this.prisma.orderItem.aggregate({
      where: { order: orderWhere },
      _sum: { lineProfit: true, quantity: true },
    });
  }

  findOrdersInRange(
    businessId: string,
    start: Date,
    end: Date,
  ) {
    return this.prisma.order.findMany({
      where: {
        businessId,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, createdAt: true, totalAmount: true },
    });
  }

  groupProfitByOrder(orderIds: string[]) {
    if (!orderIds.length) {
      return Promise.resolve(
        [] as {
          orderId: string;
          _sum: { lineProfit: Prisma.Decimal | null };
        }[],
      );
    }
    return this.prisma.orderItem.groupBy({
      by: ['orderId'],
      where: { orderId: { in: orderIds } },
      _sum: { lineProfit: true },
    });
  }

  findRestocks(businessId: string, from?: Date, to?: Date) {
    const where: Prisma.RestockLogWhereInput = { businessId };
    if (from && to) {
      where.createdAt = { gte: from, lte: to };
    }
    return (this.prisma as PrismaClient).restockLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { item: true },
      take: 200,
    });
  }
}

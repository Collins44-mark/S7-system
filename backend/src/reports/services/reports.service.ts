import { Injectable } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { OrderStatus } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import type { ReportPeriod } from '../types/report-period';

export type { ReportPeriod } from '../types/report-period';

@Injectable()
export class ReportsService {
  constructor(private readonly reports: ReportsRepository) {}

  async dashboard(user: BusinessPrincipal) {
    const businessPk = user.sub;

    const items = await this.reports.findItemsForDashboard(businessPk);

    let totalUnits = 0;
    let stockValue = new Prisma.Decimal(0);
    let lowStockCount = 0;

    for (const it of items) {
      totalUnits += it.quantity;
      stockValue = stockValue.add(
        new Prisma.Decimal(it.buyingPrice.toString()).mul(it.quantity),
      );
      if (it.quantity <= it.lowStockThreshold) {
        lowStockCount += 1;
      }
    }

    const profitAgg = await this.reports.aggregateProfitAllTime(businessPk);

    const recentOrders = await this.reports.findRecentOrders(businessPk, 10);

    return {
      totalItemSkus: items.length,
      totalUnitsInStock: totalUnits,
      stockValue: stockValue.toString(),
      totalProfitAllTime: profitAgg._sum.lineProfit?.toString() ?? '0',
      lowStockCount,
      recentOrders,
    };
  }

  async sales(
    user: BusinessPrincipal,
    period?: ReportPeriod,
    from?: string,
    to?: string,
  ) {
    const businessPk = user.sub;
    let start: Date;
    let end: Date;
    if (from && to) {
      start = new Date(from);
      end = new Date(to);
    } else {
      const r = this.reports.rangeForPeriod(period ?? 'daily');
      start = r.start;
      end = r.end;
    }

    const orderWhere: Prisma.OrderWhereInput = {
      businessId: businessPk,
      status: { not: OrderStatus.CANCELLED },
      createdAt: { gte: start, lte: end },
    };

    const salesSum = await this.reports.aggregateSales(orderWhere);

    const itemAgg = await this.reports.aggregateOrderItemsForOrders(
      orderWhere,
    );

    return {
      period: period ?? 'custom',
      start: start.toISOString(),
      end: end.toISOString(),
      totalSales: salesSum._sum.totalAmount?.toString() ?? '0',
      totalProfit: itemAgg._sum.lineProfit?.toString() ?? '0',
      itemsSold: itemAgg._sum.quantity ?? 0,
    };
  }

  async timeseries(user: BusinessPrincipal, period: ReportPeriod) {
    const { start, end } = this.reports.rangeForPeriod(period);
    const orders = await this.reports.findOrdersInRange(
      user.sub,
      start,
      end,
    );
    const ids = orders.map((o) => o.id);
    const profitByOrder = new Map<string, Prisma.Decimal>();
    if (ids.length) {
      const groups = await this.reports.groupProfitByOrder(ids);
      for (const g of groups) {
        profitByOrder.set(
          g.orderId,
          g._sum.lineProfit ?? new Prisma.Decimal(0),
        );
      }
    }
    const bucket = new Map<
      string,
      { sales: Prisma.Decimal; profit: Prisma.Decimal }
    >();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const cur = bucket.get(key) ?? {
        sales: new Prisma.Decimal(0),
        profit: new Prisma.Decimal(0),
      };
      cur.sales = cur.sales.add(new Prisma.Decimal(o.totalAmount.toString()));
      cur.profit = cur.profit.add(
        profitByOrder.get(o.id) ?? new Prisma.Decimal(0),
      );
      bucket.set(key, cur);
    }
    const dates = [...bucket.keys()].sort();
    return {
      dates,
      sales: dates.map((d) => bucket.get(d)!.sales.toString()),
      profit: dates.map((d) => bucket.get(d)!.profit.toString()),
    };
  }

  async restocks(user: BusinessPrincipal, from?: string, to?: string) {
    const fromD = from ? new Date(from) : undefined;
    const toD = to ? new Date(to) : undefined;
    return this.reports.findRestocks(
      user.sub,
      fromD && toD ? fromD : undefined,
      fromD && toD ? toD : undefined,
    );
  }
}

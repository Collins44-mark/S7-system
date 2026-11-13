import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated-imports';
import { CustomersRepository } from '../repositories/customers.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { DepositDto } from '../dto/deposit.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  private present<T extends { creditBalance: { toString(): string } }>(row: T) {
    return { ...row, creditBalance: row.creditBalance.toString() };
  }

  async list(user: BusinessPrincipal) {
    const rows = await this.customers.findAllForBusiness(user.sub);
    return rows.map((row) => this.present(row));
  }

  async accounts(user: BusinessPrincipal) {
    const rows = await this.customers.findAccounts(user.sub);
    return rows.map((row) => this.present(row));
  }

  async accountHistory(user: BusinessPrincipal, customerId: string) {
    const rows = await this.customers.findAccountEntries(user.sub, customerId);
    if (rows.length === 0) {
      const owned = await this.customers.findAllForBusiness(user.sub);
      if (!owned.some((row) => row.id === customerId)) {
        throw new NotFoundException('Customer not found');
      }
    }
    return rows.map((row) => ({
      ...row,
      amount: row.amount.toString(),
      balanceAfter: row.balanceAfter.toString(),
    }));
  }

  async receipts(user: BusinessPrincipal, customerId: string) {
    const rows = await this.customers.findReceipts(user.sub, customerId);
    if (rows.length === 0) {
      const owned = await this.customers.findAllForBusiness(user.sub);
      if (!owned.some((row) => row.id === customerId)) {
        throw new NotFoundException('Customer not found');
      }
    }
    return rows.map((order) => ({
      ...order,
      totalAmount: order.totalAmount.toString(),
      amountPaid: order.amountPaid.toString(),
      balance: order.balance.toString(),
      customer: this.present(order.customer),
      orderItems: order.orderItems.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitBuyPrice: line.unitBuyPrice.toString(),
        unitSellPrice: line.unitSellPrice.toString(),
        lineTotal: line.lineTotal.toString(),
        lineProfit: line.lineProfit.toString(),
      })),
    }));
  }

  async deposit(user: BusinessPrincipal, dto: DepositDto) {
    const row = await this.customers.deposit({
      businessId: user.sub,
      customerId: dto.customerId,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      amount: new Prisma.Decimal(String(dto.amount)),
      method: dto.method,
      note: dto.note?.trim() ? dto.note.trim() : null,
    });
    if (!row) {
      throw new NotFoundException('Customer not found');
    }
    return this.present(row);
  }
}

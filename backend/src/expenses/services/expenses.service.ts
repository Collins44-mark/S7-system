import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated-imports';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import { ExpensesRepository } from '../repositories/expenses.repository';

function present(row: {
  id: string;
  amount: Prisma.Decimal;
  note: string | null;
  spentAt: Date;
}) {
  return {
    id: row.id,
    amount: row.amount.toString(),
    note: row.note,
    spentAt: row.spentAt.toISOString(),
  };
}

@Injectable()
export class ExpensesService {
  constructor(private readonly expenses: ExpensesRepository) {}

  async list(user: BusinessPrincipal, from?: string, to?: string) {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Choose a date range.');
    }
    const rows = await this.expenses.list(user.sub, start, end);
    const total = rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    return {
      total: total.toString(),
      count: rows.length,
      items: rows.map(present),
    };
  }

  async create(user: BusinessPrincipal, body: CreateExpenseDto) {
    const spentAt = new Date(body.spentAt);
    if (Number.isNaN(spentAt.getTime())) {
      throw new BadRequestException('Choose a date.');
    }
    const row = await this.expenses.create(user.sub, {
      amount: new Prisma.Decimal(body.amount),
      note: body.note?.trim() || null,
      spentAt,
    });
    return present(row);
  }

  async remove(user: BusinessPrincipal, id: string) {
    await this.expenses.remove(user.sub, id);
    return { ok: true };
  }

  async update(user: BusinessPrincipal, id: string, body: UpdateExpenseDto) {
    const existing = await this.expenses.findOne(user.sub, id);
    if (!existing) throw new NotFoundException('Expense not found.');
    if (body.amount == null && body.note === undefined) {
      throw new BadRequestException('Nothing to update.');
    }
    const row = await this.expenses.update(id, {
      ...(body.amount != null ? { amount: new Prisma.Decimal(body.amount) } : {}),
      ...(body.note !== undefined ? { note: body.note.trim() || null } : {}),
    });
    return present(row);
  }
}

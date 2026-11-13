import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemsRepository } from '../repositories/items.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { Prisma } from '../../prisma/generated-imports';

@Injectable()
export class ItemsService {
  constructor(private readonly items: ItemsRepository) {}

  private dec(n: number | string) {
    return new Prisma.Decimal(String(n));
  }

  /** JSON must carry decimals as plain strings (never Prisma Decimal JSON blobs). */
  private withDecimalStrings<
    T extends {
      buyingPrice: { toString(): string };
      sellingPrice: { toString(): string };
      quantity: { toString(): string };
      lowStockThreshold: { toString(): string };
    },
  >(row: T) {
    return {
      ...row,
      buyingPrice: row.buyingPrice.toString(),
      sellingPrice: row.sellingPrice.toString(),
      quantity: row.quantity.toString(),
      lowStockThreshold: row.lowStockThreshold.toString(),
    };
  }

  async list(user: BusinessPrincipal, categoryId?: string) {
    const rows = await this.items.findAllWithCategory(user.sub, categoryId);
    return rows.map((row) => this.withDecimalStrings(row));
  }

  async create(user: BusinessPrincipal, dto: CreateItemDto) {
    const cat = await this.items.findCategoryOwned(user.sub, dto.categoryId);
    if (!cat) {
      throw new BadRequestException('Invalid category');
    }
    const row = await this.items.create({
      businessId: user.sub,
      name: dto.name.trim(),
      unit: dto.unit.trim(),
      categoryId: dto.categoryId,
      buyingPrice: this.dec(dto.buyingPrice),
      sellingPrice: this.dec(dto.sellingPrice),
      quantity: this.dec(dto.quantity),
      lowStockThreshold: this.dec(dto.lowStockThreshold),
    });
    return this.withDecimalStrings(row);
  }

  async update(user: BusinessPrincipal, id: string, dto: UpdateItemDto) {
    const item = await this.items.findOwned(user.sub, id);
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    if (dto.categoryId) {
      const cat = await this.items.findCategoryOwned(user.sub, dto.categoryId);
      if (!cat) {
        throw new BadRequestException('Invalid category');
      }
    }
    const row = await this.items.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.unit != null ? { unit: dto.unit.trim() } : {}),
      ...(dto.categoryId != null ? { categoryId: dto.categoryId } : {}),
      ...(dto.buyingPrice != null
        ? { buyingPrice: this.dec(dto.buyingPrice) }
        : {}),
      ...(dto.sellingPrice != null
        ? { sellingPrice: this.dec(dto.sellingPrice) }
        : {}),
      ...(dto.quantity != null ? { quantity: this.dec(dto.quantity) } : {}),
      ...(dto.lowStockThreshold != null
        ? { lowStockThreshold: this.dec(dto.lowStockThreshold) }
        : {}),
    });
    return this.withDecimalStrings(row);
  }

  async remove(user: BusinessPrincipal, id: string) {
    const item = await this.items.findOwned(user.sub, id);
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    await this.items.delete(id);
    return { ok: true };
  }

  async restock(
    user: BusinessPrincipal,
    id: string,
    quantity: number,
    notes?: string,
  ) {
    const item = await this.items.findOwned(user.sub, id);
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    try {
      const result = await this.items.restockBatch({
        businessId: user.sub,
        notes: notes?.trim() ? notes.trim() : null,
        lines: [{ itemId: id, quantity: this.dec(quantity) }],
      });
      if (!result.item) {
        throw new NotFoundException('Item not found');
      }
      return this.withDecimalStrings(result.item);
    } catch (err) {
      if (err instanceof Error && err.message === 'ITEM_NOT_FOUND') {
        throw new NotFoundException('Item not found');
      }
      throw err;
    }
  }

  async restockBulk(
    user: BusinessPrincipal,
    notes: string | undefined,
    lines: { itemId: string; quantity: number }[],
  ) {
    const seen = new Set<string>();
    const cleaned = lines.filter((line) => {
      if (seen.has(line.itemId)) return false;
      seen.add(line.itemId);
      return line.quantity > 0;
    });
    if (cleaned.length === 0) {
      throw new BadRequestException('Add a quantity for at least one item');
    }
    try {
      const result = await this.items.restockBatch({
        businessId: user.sub,
        notes: notes?.trim() ? notes.trim() : null,
        lines: cleaned.map((line) => ({
          itemId: line.itemId,
          quantity: this.dec(line.quantity),
        })),
      });
      return {
        id: result.restockId,
        number: `RST-${String(result.sequence).padStart(2, '0')}`,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'ITEM_NOT_FOUND') {
        throw new NotFoundException('Item not found');
      }
      throw err;
    }
  }
}

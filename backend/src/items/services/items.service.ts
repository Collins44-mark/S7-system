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

  list(user: BusinessPrincipal) {
    return this.items.findAllWithCategory(user.sub);
  }

  async create(user: BusinessPrincipal, dto: CreateItemDto) {
    const cat = await this.items.findCategoryOwned(user.sub, dto.categoryId);
    if (!cat) {
      throw new BadRequestException('Invalid category');
    }
    return this.items.create({
      businessId: user.sub,
      name: dto.name.trim(),
      categoryId: dto.categoryId,
      buyingPrice: this.dec(dto.buyingPrice),
      sellingPrice: this.dec(dto.sellingPrice),
      quantity: dto.quantity,
      lowStockThreshold: dto.lowStockThreshold,
    });
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
    return this.items.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.categoryId != null ? { categoryId: dto.categoryId } : {}),
      ...(dto.buyingPrice != null
        ? { buyingPrice: this.dec(dto.buyingPrice) }
        : {}),
      ...(dto.sellingPrice != null
        ? { sellingPrice: this.dec(dto.sellingPrice) }
        : {}),
      ...(dto.quantity != null ? { quantity: dto.quantity } : {}),
      ...(dto.lowStockThreshold != null
        ? { lowStockThreshold: dto.lowStockThreshold }
        : {}),
    });
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
    return this.items.restockWithLog({
      itemId: id,
      businessId: user.sub,
      quantity,
      notes: notes ?? null,
    });
  }
}

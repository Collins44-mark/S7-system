import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  list(user: BusinessPrincipal) {
    return this.categories.findAllForBusiness(user.sub);
  }

  async create(user: BusinessPrincipal, name: string) {
    try {
      return await this.categories.create(user.sub, name.trim());
    } catch {
      throw new ConflictException('Category name already exists');
    }
  }

  async update(user: BusinessPrincipal, id: string, name: string) {
    const cat = await this.categories.findOwned(user.sub, id);
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
    try {
      return await this.categories.updateName(id, name.trim());
    } catch {
      throw new ConflictException('Category name already exists');
    }
  }

  async remove(user: BusinessPrincipal, id: string) {
    const cat = await this.categories.findOwned(user.sub, id);
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
    if (cat._count.items > 0) {
      throw new ConflictException('Cannot delete category with items');
    }
    await this.categories.delete(id);
    return { ok: true };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForBusiness(businessId: string) {
    return this.prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  create(businessId: string, name: string) {
    return this.prisma.category.create({
      data: { name, businessId },
    });
  }

  findOwned(businessId: string, id: string) {
    return this.prisma.category.findFirst({
      where: { id, businessId },
      include: { _count: { select: { items: true } } },
    });
  }

  updateName(id: string, name: string) {
    return this.prisma.category.update({
      where: { id },
      data: { name },
    });
  }

  delete(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}

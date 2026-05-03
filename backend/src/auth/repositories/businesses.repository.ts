import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const businessPublicSelect = {
  id: true,
  name: true,
  uniqueCode: true,
  createdAt: true,
  receiptPaperWidthMm: true,
  printReceiptAfterSale: true,
  receiptPrinterAddress: true,
} as const;

@Injectable()
export class BusinessesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUniqueCode(uniqueCode: string) {
    return this.prisma.business.findUnique({ where: { uniqueCode } });
  }

  findById(id: string) {
    return this.prisma.business.findUnique({ where: { id } });
  }

  updateById(
    id: string,
    data: { name?: string; isActive?: boolean },
  ) {
    return this.prisma.business.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        uniqueCode: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  findPublicProfile(businessPk: string) {
    return this.prisma.business.findUniqueOrThrow({
      where: { id: businessPk },
      select: businessPublicSelect,
    });
  }

  updatePublicProfile(
    businessPk: string,
    data: {
      name?: string;
      receiptPaperWidthMm?: number;
      printReceiptAfterSale?: boolean;
      receiptPrinterAddress?: string | null;
    },
  ) {
    return this.prisma.business.update({
      where: { id: businessPk },
      data,
      select: businessPublicSelect,
    });
  }

  /** Load minimal fields after JWT claims */
  findByIdForAuth(id: string) {
    return this.prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        uniqueCode: true,
        isActive: true,
      },
    });
  }

  findManyOrdered() {
    return this.prisma.business.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        uniqueCode: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  createBusiness(data: {
    name: string;
    uniqueCode: string;
    passwordHash: string;
  }) {
    return this.prisma.business.create({
      data,
      select: {
        id: true,
        name: true,
        uniqueCode: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.business.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        uniqueCode: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  findAllUniqueCodes() {
    return this.prisma.business.findMany({
      select: { uniqueCode: true },
    });
  }
}

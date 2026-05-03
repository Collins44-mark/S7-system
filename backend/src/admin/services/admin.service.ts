import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BusinessesRepository } from '../../auth/repositories/businesses.repository';
import type { CreateBusinessDto } from '../dto/create-business.dto';
import type { UpdateBusinessDto } from '../dto/update-business.dto';

@Injectable()
export class AdminService {
  constructor(private readonly businesses: BusinessesRepository) {}

  listBusinesses() {
    return this.businesses.findManyOrdered();
  }

  async createBusiness(dto: CreateBusinessDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const uniqueCode = await this.allocateNextUniqueCode();
    try {
      return await this.businesses.createBusiness({
        name: dto.name.trim(),
        uniqueCode,
        passwordHash,
      });
    } catch {
      throw new BadRequestException('Could not create business (try again)');
    }
  }

  async updateBusiness(id: string, dto: UpdateBusinessDto) {
    const row = await this.businesses.findById(id);
    if (!row) {
      throw new NotFoundException('Business not found');
    }
    const data: { name?: string; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide name and/or isActive');
    }
    return this.businesses.updateById(id, data);
  }

  /** Sequential S7-XXXX — max numeric suffix + 1, padded to 4 digits */
  private async allocateNextUniqueCode(): Promise<string> {
    const rows = await this.businesses.findAllUniqueCodes();
    let max = 0;
    for (const { uniqueCode } of rows) {
      const m = /^S7-(\d+)$/.exec(uniqueCode);
      if (m) {
        max = Math.max(max, parseInt(m[1], 10));
      }
    }
    const next = max + 1;
    if (next > 9999) {
      throw new BadRequestException(
        'Business ID sequence exhausted (max S7-9999)',
      );
    }
    return `S7-${String(next).padStart(4, '0')}`;
  }
}

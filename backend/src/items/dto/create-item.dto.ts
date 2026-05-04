import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  unit: string;

  /** Category PK is a Prisma `cuid()`, not a UUID */
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  buyingPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockThreshold: number;
}

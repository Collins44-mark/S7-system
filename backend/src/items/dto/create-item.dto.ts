import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUUID()
  categoryId: string;

  @Type(() => Number)
  @Min(0)
  buyingPrice: number;

  @Type(() => Number)
  @Min(0)
  sellingPrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold: number;
}

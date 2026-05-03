import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(60)
  receiptPaperWidthMm?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  printReceiptAfterSale?: boolean;
}

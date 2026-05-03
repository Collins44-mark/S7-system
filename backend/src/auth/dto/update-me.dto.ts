import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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
  @Min(58)
  @Max(80)
  receiptPaperWidthMm?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  printReceiptAfterSale?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptPrinterAddress?: string | null;
}

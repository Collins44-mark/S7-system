import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim() !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  poBox?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vrn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(350_000)
  logoDataUrl?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === '' ? null : Number(value),
  )
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(48)
  @Max(80)
  receiptPaperWidthMm?: number | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  printReceiptAfterSale?: boolean;
}

import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import type { PaymentMethod } from '../../prisma/generated-imports';

const DEPOSIT_METHODS: PaymentMethod[] = [
  'CASH',
  'AIRTEL_MONEY',
  'MPESA',
  'TIGO_PESA',
  'BANK',
];

export class DepositDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(DEPOSIT_METHODS)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import type { PaymentMethod } from '../../../generated/prisma/enums';

const PAYMENT_VALUES: PaymentMethod[] = [
  'CASH',
  'AIRTEL_MONEY',
  'MPESA',
  'TIGO_PESA',
  'BANK',
];

export class PayDebtDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsIn(PAYMENT_VALUES)
  paymentMethod: PaymentMethod;
}

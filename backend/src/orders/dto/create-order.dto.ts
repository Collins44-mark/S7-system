import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { PaymentMethod } from '../../prisma/generated-imports';

const PAYMENT_VALUES: PaymentMethod[] = [
  'CASH',
  'AIRTEL_MONEY',
  'MPESA',
  'TIGO_PESA',
  'BANK',
];

export class OrderLineDto {
  /** Item PK is a Prisma `cuid()`, not a UUID */
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @Type(() => Number)
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  customerName: string;

  @IsString()
  @MinLength(1)
  customerPhone: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  @IsIn(PAYMENT_VALUES)
  paymentMethod: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid: number;
}

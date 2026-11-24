import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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
  'ACCOUNT',
];

export class OrderLineDto {
  /** Item PK is a Prisma `cuid()`, not a UUID */
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  customerName: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

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

  /** Optional service or other non-inventory charge included in the order total. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherCharges?: number;

  /** Amount taken off the items and other charges before the customer pays. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;
}

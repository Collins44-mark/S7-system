import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderLineDto } from './create-order.dto';

/** Items on a confirmed order can be corrected without changing its recorded payment. */
export class UpdateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  /** Total payment recorded against the order, including later debt payments. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;

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

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  customerName?: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;
}

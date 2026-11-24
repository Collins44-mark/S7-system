import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
}

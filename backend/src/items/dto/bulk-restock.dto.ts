import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkRestockLineDto {
  @IsString()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;
}

export class BulkRestockDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkRestockLineDto)
  items: BulkRestockLineDto[];
}

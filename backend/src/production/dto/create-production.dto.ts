import { Type } from 'class-transformer';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateProductionDto {
  @IsString()
  @MinLength(1)
  sourceItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  sourceQuantity!: number;

  @IsString()
  @MinLength(1)
  resultItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  resultQuantity!: number;
}

import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RestockDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

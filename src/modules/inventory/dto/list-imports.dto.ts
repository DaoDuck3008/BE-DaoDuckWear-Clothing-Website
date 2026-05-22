import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IMPORT_STATUS } from '../schemas/inventory-import.schema';

export class ListImportsDto {
  @IsOptional()
  @IsMongoId({ message: 'shopId không hợp lệ' })
  shopId?: string;

  @IsOptional()
  @IsMongoId({ message: 'productId không hợp lệ' })
  productId?: string;

  @IsOptional()
  @IsIn(Object.values(IMPORT_STATUS), { message: 'status không hợp lệ' })
  status?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from phải là ISO date' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to phải là ISO date' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sort?: string;
}

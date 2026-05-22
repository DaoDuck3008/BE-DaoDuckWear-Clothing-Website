import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateImportItemDto {
  @IsMongoId({ message: 'variantId không hợp lệ' })
  variantId!: string;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity phải >= 1' })
  quantity!: number;
}

export class CreateImportDto {
  @IsMongoId({ message: 'productId không hợp lệ' })
  productId!: string;

  @IsArray({ message: 'items phải là mảng' })
  @ArrayMinSize(1, { message: 'Phiếu nhập phải có ít nhất 1 biến thể' })
  @ValidateNested({ each: true })
  @Type(() => CreateImportItemDto)
  items!: CreateImportItemDto[];

  @IsOptional()
  @IsMongoId({ message: 'shopId không hợp lệ' })
  shopId?: string;

  @IsOptional()
  @IsString({ message: 'note phải là chuỗi' })
  @MaxLength(500, { message: 'note tối đa 500 ký tự' })
  note?: string;
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductVariantDto {
  @IsString()
  size!: string;

  @IsString()
  color!: string;

  @IsString()
  @IsOptional()
  colorHexId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsString()
  sku!: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty({ message: 'Vui lòng nhập số lượng tồn kho' })
  stock!: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  categoryId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn cửa hàng' })
  shopId!: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Vui lòng nhập giá cơ bản' })
  @Type(() => Number)
  basePrice!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}

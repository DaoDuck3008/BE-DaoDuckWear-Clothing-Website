import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductVariantDto {
  // Có id → cập nhật variant cũ; không có id → tạo variant mới
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Size không được để trống' })
  size!: string;

  @IsString()
  @IsNotEmpty({ message: 'Màu không được để trống' })
  color!: string;

  @IsString()
  @IsOptional()
  colorHexId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsString()
  @IsNotEmpty({ message: 'SKU không được để trống' })
  sku!: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  basePrice?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  // JSON string được parse từ FormData → mảng variant cần cập nhật
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  @IsOptional()
  variants?: UpdateProductVariantDto[];

  // Danh sách publicId ảnh Cloudinary cần xóa
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deleteImageIds?: string[];
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateVoucherDto {
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Transform(({ value }) => value?.trim())
  note?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị giảm phải là số' })
  @IsPositive({ message: 'Giá trị giảm phải lớn hơn 0' })
  discountValue?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị đơn hàng tối thiểu phải là số' })
  @Min(0, { message: 'Giá trị đơn hàng tối thiểu không được âm' })
  minOrderValue?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'Số tiền giảm tối đa phải là số' })
  @IsPositive({ message: 'Số tiền giảm tối đa phải lớn hơn 0' })
  maxDiscountAmount?: number | null;

  @IsOptional()
  @IsInt({ message: 'Giới hạn lượt dùng phải là số nguyên' })
  @IsPositive({ message: 'Giới hạn lượt dùng phải lớn hơn 0' })
  usageLimit?: number | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiredAt?: string | null;
}

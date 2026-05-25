import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from '../../orders/schemas/voucher.schema';

export class CreateVoucherDto {
  @IsString({ message: 'Mã voucher phải là chuỗi ký tự' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  @IsEnum(DiscountType, { message: 'Loại giảm giá không hợp lệ' })
  discountType!: DiscountType;

  @IsNumber({}, { message: 'Giá trị giảm phải là số' })
  @IsPositive({ message: 'Giá trị giảm phải lớn hơn 0' })
  discountValue!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị đơn hàng tối thiểu phải là số' })
  @Min(0, { message: 'Giá trị đơn hàng tối thiểu không được âm' })
  minOrderValue?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Số tiền giảm tối đa phải là số' })
  @IsPositive({ message: 'Số tiền giảm tối đa phải lớn hơn 0' })
  maxDiscountAmount?: number;

  @IsOptional()
  @IsInt({ message: 'Giới hạn lượt dùng phải là số nguyên' })
  @IsPositive({ message: 'Giới hạn lượt dùng phải lớn hơn 0' })
  usageLimit?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiredAt?: string;
}

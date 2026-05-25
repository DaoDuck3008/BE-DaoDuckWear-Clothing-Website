import { IsString, IsNumber, IsPositive } from 'class-validator';

export class ValidateVoucherDto {
  @IsString({ message: 'Mã voucher phải là chuỗi ký tự' })
  code!: string;

  @IsNumber({}, { message: 'Giá trị đơn hàng phải là số' })
  @IsPositive({ message: 'Giá trị đơn hàng phải lớn hơn 0' })
  orderTotal!: number;
}

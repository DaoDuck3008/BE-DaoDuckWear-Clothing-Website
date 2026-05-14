import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const PROVIDERS = ['local', 'google', 'facebook'] as const;

export class ListCustomerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[], {
    message: 'Phương thức đăng nhập không hợp lệ',
  })
  provider?: (typeof PROVIDERS)[number];

  @IsOptional()
  @IsBooleanString({ message: 'Trạng thái xác thực không hợp lệ' })
  isVerified?: string;

  @IsOptional()
  @IsBooleanString({ message: 'Trạng thái khóa không hợp lệ' })
  isLocked?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class ListCustomerOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;
}

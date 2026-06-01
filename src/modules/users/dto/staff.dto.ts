import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const STAFF_ROLES = [
  'ADMIN',
  'MANAGER',
  'STAFF',
  'RECEPTIONIST',
] as const;
export type StaffRoleName = (typeof STAFF_ROLES)[number];

export const EMPLOYMENT_STATUSES = ['active', 'onLeave', 'terminated'] as const;
export const GENDERS = ['male', 'female', 'other'] as const;

export class StaffProfileDto {
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  fullName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(GENDERS as unknown as string[], { message: 'Giới tính không hợp lệ' })
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsString({ message: 'CCCD phải là chuỗi ký tự' })
  nationalId?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Quê quán phải là chuỗi ký tự' })
  hometown?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ thường trú phải là chuỗi ký tự' })
  permanentAddress?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ hiện tại phải là chuỗi ký tự' })
  currentAddress?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày vào làm không hợp lệ' })
  hireDate?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES as unknown as string[], {
    message: 'Trạng thái làm việc không hợp lệ',
  })
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @IsOptional()
  @IsString({ message: 'Vị trí phải là chuỗi ký tự' })
  position?: string;
}

export class CreateStaffDto extends StaffProfileDto {
  @IsString({ message: 'Tên đăng nhập phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên đăng nhập là bắt buộc' })
  username!: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsIn(STAFF_ROLES as unknown as string[], {
    message: 'Vai trò không hợp lệ',
  })
  role!: StaffRoleName;

  @IsOptional()
  @IsMongoId({ message: 'Mã chi nhánh không hợp lệ' })
  shopId?: string;
}

export class UpdateStaffDto extends StaffProfileDto {
  @IsOptional()
  @IsString({ message: 'Tên đăng nhập phải là chuỗi ký tự' })
  username?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES as unknown as string[], {
    message: 'Vai trò không hợp lệ',
  })
  role?: StaffRoleName;

  @IsOptional()
  @IsMongoId({ message: 'Mã chi nhánh không hợp lệ' })
  shopId?: string | null;
}

export class ListStaffQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES as unknown as string[], {
    message: 'Vai trò không hợp lệ',
  })
  role?: StaffRoleName;

  @IsOptional()
  @IsMongoId({ message: 'Mã chi nhánh không hợp lệ' })
  shopId?: string;

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

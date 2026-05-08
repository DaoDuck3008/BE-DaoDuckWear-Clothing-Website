import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { IsMatch } from '../../../common/decorators/is-match.decorator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  username!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ in hoa' })
  @Matches(/\d/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ số' })
  password!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ in hoa' })
  @Matches(/\d/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ số' })
  @IsMatch('password', { message: 'Mật khẩu xác nhận không khớp' })
  confirmPassword!: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  username?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)[0-9]{8,9}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;
}

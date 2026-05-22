import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeImportDto {
  @IsOptional()
  @IsString({ message: 'note phải là chuỗi' })
  @MaxLength(500, { message: 'note tối đa 500 ký tự' })
  note?: string;
}

import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class ListVouchersDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'DELETED';
}

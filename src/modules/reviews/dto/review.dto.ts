import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';

export class CreateReviewDto {
  @IsMongoId({ message: 'productId không hợp lệ' })
  productId!: string;

  @IsNumber({}, { message: 'rating phải là số' })
  @Min(1, { message: 'rating tối thiểu là 1 sao' })
  @Max(5, { message: 'rating tối đa là 5 sao' })
  rating!: number;

  @IsOptional()
  @IsString({ message: 'comment phải là chuỗi ký tự' })
  comment?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsNumber({}, { message: 'rating phải là số' })
  @Min(1, { message: 'rating tối thiểu là 1 sao' })
  @Max(5, { message: 'rating tối đa là 5 sao' })
  rating?: number;

  @IsOptional()
  @IsString({ message: 'comment phải là chuỗi ký tự' })
  comment?: string;
}

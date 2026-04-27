import { IsNotEmpty, IsNumber, IsString, Min, Max } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  shopId!: string;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  quantity!: number;
}

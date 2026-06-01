import { IsMongoId } from 'class-validator';

export class CreateConversationDto {
  @IsMongoId({ message: 'Mã cửa hàng không hợp lệ' })
  shopId!: string;
}

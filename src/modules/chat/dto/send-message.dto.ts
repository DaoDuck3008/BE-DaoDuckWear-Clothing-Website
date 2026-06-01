import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId({ message: 'Mã hội thoại không hợp lệ' })
  conversationId!: string;

  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn tối đa 2000 ký tự' })
  content!: string;
}

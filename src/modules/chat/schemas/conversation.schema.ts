import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  // Khách hàng (luôn là role USER)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  customerId!: Types.ObjectId;

  // Cửa hàng (chi nhánh) mà khách đang trao đổi
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: String, default: null })
  lastMessage?: string | null;

  @Prop({ type: Date, default: null })
  lastMessageAt?: Date | null;

  // Số tin chưa đọc của từng phía
  @Prop({ type: Number, default: 0 })
  customerUnread!: number;

  @Prop({ type: Number, default: 0 })
  shopUnread!: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Mỗi cặp (khách, shop) chỉ có duy nhất 1 hội thoại
ConversationSchema.index({ customerId: 1, shopId: 1 }, { unique: true });
// Phục vụ inbox phía cửa hàng (sort theo tin mới nhất)
ConversationSchema.index({ shopId: 1, lastMessageAt: -1 });

applyIdVirtual(ConversationSchema);

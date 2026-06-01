import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type MessageDocument = HydratedDocument<Message>;

export enum SenderType {
  CUSTOMER = 'customer',
  SHOP = 'shop',
}

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId!: Types.ObjectId;

  // Người gửi thực tế (khách hoặc nhân viên)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ type: String, enum: SenderType, required: true })
  senderType!: SenderType;

  @Prop({ type: String, required: true, trim: true })
  content!: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

applyIdVirtual(MessageSchema);

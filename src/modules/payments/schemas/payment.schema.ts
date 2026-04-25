import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: null })
  method?: string | null;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Prop({ type: String, trim: true, default: null })
  transactionId?: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ orderId: 1 }, { unique: true });
PaymentSchema.index({ status: 1 });
applyIdVirtual(PaymentSchema);

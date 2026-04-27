import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPING = 'SHIPPING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

@Schema({ _id: false })
class OrderItemSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: String, required: true })
  size!: string;

  @Prop({ type: String, required: true })
  color!: string;

  @Prop({ type: Number, required: true })
  price!: number;

  @Prop({ type: Number, required: true })
  quantity!: number;
}

const OrderItemSnapshotSchema = SchemaFactory.createForClass(OrderItemSnapshot);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: String, required: true })
  orderCode!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({
    type: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      province: { type: String, required: true },
      ward: { type: String, required: true },
      address: { type: String, required: true },
      note: { type: String },
    },
    required: true,
  })
  shippingAddress!: {
    fullName: string;
    email: string;
    phone: string;
    province: string;
    ward: string;
    address: string;
    note?: string;
  };

  @Prop({ type: [OrderItemSnapshotSchema], required: true })
  items!: OrderItemSnapshot[];

  @Prop({ type: Number, required: true })
  totalAmount!: number;

  @Prop({ type: Number, default: 0 })
  shippingFee!: number;

  @Prop({ type: Number, required: true })
  finalTotal!: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Prop({
    type: String,
    enum: ['COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO'],
    required: true,
  })
  paymentMethod!: string;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus!: PaymentStatus;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ orderCode: 1 }, { unique: true });
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });

applyIdVirtual(OrderSchema);

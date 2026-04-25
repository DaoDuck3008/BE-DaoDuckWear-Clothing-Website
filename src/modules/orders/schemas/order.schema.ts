import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class OrderItemSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ProductVariant', required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  slug!: string;

  @Prop({ type: String, required: true })
  sku!: string;

  @Prop({ type: String, default: null })
  color?: string | null;

  @Prop({ type: String, default: null })
  size?: string | null;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true })
  priceAtPurchase!: number;
}

export const OrderItemSnapshotSchema =
  SchemaFactory.createForClass(OrderItemSnapshot);

@Schema({ _id: false })
export class OrderVoucherSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Voucher', default: null })
  voucherId?: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  code!: string;

  @Prop({ type: String, required: true, enum: ['PERCENTAGE', 'FIXED'] })
  discountType!: string;

  @Prop({ type: Number, required: true })
  discountValue!: number;
}

export const OrderVoucherSnapshotSchema =
  SchemaFactory.createForClass(OrderVoucherSnapshot);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({ type: Number, required: true })
  totalAmount!: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Prop({ type: Object, required: true })
  addressSnapshot!: Record<string, any>;

  @Prop({ type: Number, default: null })
  shippingFee?: number | null;

  @Prop({ type: String, default: null })
  shippingMethod?: string | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', default: null })
  shopId?: Types.ObjectId | null;

  @Prop({ type: [OrderItemSnapshotSchema], default: [] })
  items!: OrderItemSnapshot[];

  @Prop({ type: [OrderVoucherSnapshotSchema], default: [] })
  vouchers!: OrderVoucherSnapshot[];

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1 });
OrderSchema.index({ shopId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.pre('findOneAndDelete', async function (this: any) {
  const order = await this.model.findOne(this.getFilter()).lean();
  if (order) {
    await this.model.db.model('Payment').deleteOne({ orderId: order._id });
  }
});
applyIdVirtual(OrderSchema);

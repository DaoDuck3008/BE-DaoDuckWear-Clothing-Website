import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ _id: true, timestamps: true })
export class CartItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ProductVariant', required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 100 })
  quantity!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items!: CartItem[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);


CartSchema.index({ userId: 1, 'items.variantId': 1 });
applyIdVirtual(CartItemSchema);
applyIdVirtual(CartSchema);

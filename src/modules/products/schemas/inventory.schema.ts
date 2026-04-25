import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type InventoryDocument = HydratedDocument<Inventory>;

@Schema({ timestamps: true, collection: 'inventories' })
export class Inventory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ProductVariant', required: true })
  variantId!: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  quantity!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  reservedQuantity!: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

InventorySchema.index({ shopId: 1, variantId: 1 }, { unique: true });
InventorySchema.index({ productId: 1 });
applyIdVirtual(InventorySchema);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ProductVariantDocument = HydratedDocument<ProductVariant>;

@Schema({ timestamps: true, collection: 'product_variants' })
export class ProductVariant {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: null })
  size?: string | null;

  @Prop({ type: String, trim: true, default: null })
  color?: string | null;

  @Prop({ type: String, default: null })
  image?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Color', default: null })
  colorHexId?: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  price?: number | null;

  @Prop({ type: String, required: true, trim: true })
  sku!: string;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

ProductVariantSchema.index({ sku: 1 }, { unique: true });
ProductVariantSchema.index({ productId: 1 });
ProductVariantSchema.index({ colorHexId: 1 });
ProductVariantSchema.pre('findOneAndDelete', async function (this: any) {
  const variant = await this.model.findOne(this.getFilter()).lean();
  if (!variant) return;

  const hasOrders = await this.model.db
    .model('Order')
    .exists({ 'items.variantId': variant._id });
  if (hasOrders) {
    throw new Error('Không thể xóa biến thể đã phát sinh đơn hàng');
  }

  await Promise.all([
    this.model.db.model('Inventory').deleteMany({ variantId: variant._id }),
    this.model.db
      .model('Cart')
      .updateMany({}, { $pull: { items: { variantId: variant._id } } }),
  ]);
});
applyIdVirtual(ProductVariantSchema);

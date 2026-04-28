import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: true, timestamps: true })
export class ProductImage {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String, default: null })
  publicId?: string | null;

  @Prop({ type: String, default: null, uppercase: true })
  color?: string | null;

  @Prop({ type: Boolean, default: false })
  isMain?: boolean;

  @Prop({ type: Boolean, default: false })
  isThumbnail?: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  slug!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: Number, required: true })
  basePrice!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
  categoryId?: Types.ObjectId | null;

  @Prop({ type: String, default: 'active', trim: true })
  status?: string;

  @Prop({ type: [ProductImageSchema], default: [] })
  images!: ProductImage[];

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.pre('findOneAndDelete', async function (this: any) {
  const product = await this.model.findOne(this.getFilter()).lean();
  if (!product) return;

  const hasOrders = await this.model.db
    .model('Order')
    .exists({ 'items.productId': product._id });
  if (hasOrders) {
    throw new Error(
      'KhÃ´ng thá»ƒ xÃ³a sáº£n pháº©m Ä‘Ã£ phÃ¡t sinh Ä‘Æ¡n hÃ ng',
    );
  }

  const variants = await this.model.db
    .model('ProductVariant')
    .find({ productId: product._id })
    .select('_id')
    .lean();
  const variantIds = variants.map((variant: any) => variant._id);

  await Promise.all([
    this.model.db
      .model('ProductVariant')
      .deleteMany({ productId: product._id }),
    this.model.db.model('Inventory').deleteMany({ productId: product._id }),
    this.model.db.model('Favorite').deleteMany({ productId: product._id }),
    this.model.db.model('Review').deleteMany({ productId: product._id }),
    this.model.db
      .model('Cart')
      .updateMany({}, { $pull: { items: { variantId: { $in: variantIds } } } }),
  ]);
});
applyIdVirtual(ProductImageSchema);
applyIdVirtual(ProductSchema);

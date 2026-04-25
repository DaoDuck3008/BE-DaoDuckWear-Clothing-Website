import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ShopDocument = HydratedDocument<Shop>;

@Schema({ timestamps: true, collection: 'shops' })
export class Shop {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, trim: true, default: null })
  slug?: string | null;

  @Prop({ type: Number, default: null })
  wardCode?: number | null;

  @Prop({ type: String, trim: true, default: null })
  wardName?: string | null;

  @Prop({ type: Number, default: null })
  cityCode?: number | null;

  @Prop({ type: String, trim: true, default: null })
  cityName?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ShopSchema = SchemaFactory.createForClass(Shop);

ShopSchema.index({ slug: 1 }, { unique: true, sparse: true });
ShopSchema.pre('findOneAndDelete', async function (this: any) {
  const shop = await this.model.findOne(this.getFilter()).lean();
  if (!shop) return;

  await Promise.all([
    this.model.db.model('Inventory').deleteMany({ shopId: shop._id }),
    this.model.db.model('Order').updateMany(
      { shopId: shop._id },
      { $set: { shopId: null } },
    ),
  ]);

});
applyIdVirtual(ShopSchema);

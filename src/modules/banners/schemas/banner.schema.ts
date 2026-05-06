import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ timestamps: true, collection: 'banners' })
export class Banner {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, required: true })
  imageUrl!: string;

  @Prop({ type: String, required: true })
  publicId!: string;

  @Prop({ type: String, default: null })
  mobileImageUrl?: string | null;

  @Prop({ type: String, default: null })
  mobilePublicId?: string | null;

  @Prop({ type: String, default: null })
  linkUrl?: string | null;

  // Trang hiển thị banner: 'home' | 'login' | 'shop' | ...
  @Prop({ type: String, required: true, trim: true })
  page!: string;

  // Vị trí trên trang: 'hero' | 'sidebar' | 'footer' | 'popup' | ...
  @Prop({ type: String, required: true, trim: true })
  position!: string;

  @Prop({ type: Number, default: 0 })
  sortOrder?: number;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  @Prop({ type: Date, default: null })
  startAt?: Date | null;

  @Prop({ type: Date, default: null })
  endAt?: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

BannerSchema.index({ page: 1, position: 1 });
BannerSchema.index({ isActive: 1 });
BannerSchema.index({ sortOrder: 1 });

applyIdVirtual(BannerSchema);

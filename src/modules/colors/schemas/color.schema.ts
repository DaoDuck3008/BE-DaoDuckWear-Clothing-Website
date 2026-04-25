import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ColorDocument = HydratedDocument<Color>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'colors' })
export class Color {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  slug!: string;

  @Prop({ type: String, required: true, trim: true })
  hexCode!: string;
}

export const ColorSchema = SchemaFactory.createForClass(Color);

ColorSchema.index({ name: 1 }, { unique: true });
ColorSchema.index({ slug: 1 }, { unique: true });
ColorSchema.index({ hexCode: 1 }, { unique: true });
ColorSchema.pre('findOneAndDelete', async function (this: any) {
  const color = await this.model.findOne(this.getFilter()).lean();
  if (color) {
    await this.model.db
      .model('ProductVariant')
      .updateMany({ colorHexId: color._id }, { $set: { colorHexId: null } });
  }
});
applyIdVirtual(ColorSchema);

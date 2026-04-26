import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  slug!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
  parentId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ parentId: 1 });
CategorySchema.index({ slug: 1 });

CategorySchema.pre('findOneAndDelete', async function (this: any) {
  const category = await this.model.findOne(this.getFilter()).lean();
  if (!category) return;

  const hasProducts = await this.model.db
    .model('Product')
    .exists({ categoryId: category._id, deletedAt: null });
  if (hasProducts) {
    throw new Error('Không thể xóa danh mục đang có sản phẩm');
  }

  await this.model.updateMany(
    { parentId: category._id },
    { $set: { parentId: null } },
  );
});

applyIdVirtual(CategorySchema);

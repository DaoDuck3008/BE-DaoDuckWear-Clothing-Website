import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', default: null })
  productId?: Types.ObjectId | null;

  @Prop({ type: Number, min: 1, max: 5, default: null })
  rating?: number | null;

  @Prop({ type: String, default: null })
  comment?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ productId: 1 });
ReviewSchema.index({ userId: 1 });
applyIdVirtual(ReviewSchema);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, required: true, trim: true })
  slug!: string;

  @Prop({ type: String, default: null })
  content?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  authorId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ slug: 1 }, { unique: true });
PostSchema.index({ authorId: 1 });
applyIdVirtual(PostSchema);

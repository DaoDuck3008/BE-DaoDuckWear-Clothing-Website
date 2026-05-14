import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: true })
export class Address {
  @Prop({ type: String, required: true, trim: true })
  address!: string;

  @Prop({ type: String, trim: true, default: null })
  phone?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: String, required: true, trim: true })
  username!: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, default: null })
  password?: string | null;

  @Prop({ type: String, default: 'local', index: true })
  provider!: 'local' | 'google' | 'facebook';

  @Prop({ type: String, default: null })
  providerId?: string | null;

  @Prop({ type: String, default: null })
  avatar?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Role', default: null })
  roleId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', default: null })
  shopId?: Types.ObjectId | null;

  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Address[];

  @Prop({ type: Boolean, default: false })
  isVerified!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isLocked!: boolean;

  @Prop({ type: String, trim: true, default: null })
  fullName?: string | null;

  @Prop({ type: Date, default: null })
  dateOfBirth?: Date | null;

  @Prop({
    type: String,
    enum: ['male', 'female', 'other'],
    default: null,
  })
  gender?: 'male' | 'female' | 'other' | null;

  @Prop({ type: String, trim: true, default: null })
  nationalId?: string | null;

  @Prop({ type: String, trim: true, default: null })
  phone?: string | null;

  @Prop({ type: String, trim: true, default: null })
  hometown?: string | null;

  @Prop({ type: String, trim: true, default: null })
  permanentAddress?: string | null;

  @Prop({ type: String, trim: true, default: null })
  currentAddress?: string | null;

  @Prop({ type: Date, default: null })
  hireDate?: Date | null;

  @Prop({
    type: String,
    enum: ['active', 'onLeave', 'terminated'],
    default: null,
  })
  employmentStatus?: 'active' | 'onLeave' | 'terminated' | null;

  @Prop({ type: String, trim: true, default: null })
  position?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ roleId: 1 });
UserSchema.index({ shopId: 1 });
UserSchema.index({ nationalId: 1 }, { sparse: true });
UserSchema.pre('findOneAndDelete', async function (this: any) {
  const user = await this.model.findOne(this.getFilter()).lean();
  if (!user) return;

  const hasOrders = await this.model.db
    .model('Order')
    .exists({ userId: user._id });
  if (hasOrders) {
    throw new Error('Không thể xóa user đã có đơn hàng');
  }

  await Promise.all([
    this.model.db.model('Cart').deleteOne({ userId: user._id }),
    this.model.db.model('Favorite').deleteMany({ userId: user._id }),
    this.model.db
      .model('Review')
      .updateMany({ userId: user._id }, { $set: { userId: null } }),
    this.model.db
      .model('Post')
      .updateMany({ authorId: user._id }, { $set: { authorId: null } }),
    this.model.db
      .model('AuditLog')
      .updateMany({ userId: user._id }, { $set: { userId: null } }),
  ]);
});
applyIdVirtual(UserSchema);

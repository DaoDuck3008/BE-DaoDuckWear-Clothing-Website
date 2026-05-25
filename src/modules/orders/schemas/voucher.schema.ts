import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type VoucherDocument = HydratedDocument<Voucher>;

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

@Schema({ timestamps: true, collection: 'vouchers' })
export class Voucher {
  @Prop({ type: String, required: true, trim: true })
  code!: string;

  @Prop({ type: String, enum: DiscountType, required: true })
  discountType!: DiscountType;

  @Prop({ type: Number, required: true })
  discountValue!: number;

  @Prop({ type: Number, default: null })
  minOrderValue?: number | null;

  @Prop({ type: Number, default: null })
  maxDiscountAmount?: number | null;

  @Prop({ type: Number, default: null })
  usageLimit?: number | null;

  @Prop({ type: Number, default: 0 })
  usedCount!: number;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  usedByUsers!: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  expiredAt?: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);

VoucherSchema.index({ code: 1 }, { unique: true });
VoucherSchema.index({ expiredAt: 1 }, { sparse: true });
VoucherSchema.index({ usedByUsers: 1 });
applyIdVirtual(VoucherSchema);

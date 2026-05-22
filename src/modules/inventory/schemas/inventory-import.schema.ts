import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type InventoryImportDocument = HydratedDocument<InventoryImport>;

export const IMPORT_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

@Schema({ _id: false })
export class InventoryImportItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true,
  })
  variantId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: String, default: null })
  sku?: string | null;
}

export const InventoryImportItemSchema =
  SchemaFactory.createForClass(InventoryImportItem);

@Schema({ timestamps: true, collection: 'inventory_imports' })
export class InventoryImport {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: [InventoryImportItemSchema], required: true })
  items!: InventoryImportItem[];

  @Prop({ type: Number, required: true, min: 1 })
  totalQuantity!: number;

  @Prop({
    type: String,
    enum: Object.values(IMPORT_STATUS),
    default: IMPORT_STATUS.ACTIVE,
  })
  status!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  revokedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  @Prop({ type: String, default: null })
  note?: string | null;
}

export const InventoryImportSchema =
  SchemaFactory.createForClass(InventoryImport);

InventoryImportSchema.index({ shopId: 1, createdAt: -1 });
InventoryImportSchema.index({ productId: 1, createdAt: -1 });
InventoryImportSchema.index({ status: 1, createdAt: -1 });
applyIdVirtual(InventoryImportSchema);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({ type: String, required: true, trim: true })
  action!: string;

  @Prop({ type: String, required: true, trim: true })
  entityName!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  entityId?: Types.ObjectId | null;

  @Prop({ type: Object, default: null })
  oldData?: Record<string, any> | null;

  @Prop({ type: Object, default: null })
  newData?: Record<string, any> | null;

  @Prop({ type: String, default: null })
  ipAddress?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ entityName: 1, entityId: 1 });
applyIdVirtual(AuditLogSchema);

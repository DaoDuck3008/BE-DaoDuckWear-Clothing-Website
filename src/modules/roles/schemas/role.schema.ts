import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyIdVirtual } from '../../../common/utils/mongoose-schema.util';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.pre('findOneAndDelete', async function (this: any) {
  const role = await this.model.findOne(this.getFilter()).lean();
  if (role) {
    await this.model.db
      .model('User')
      .updateMany({ roleId: role._id }, { $set: { roleId: null } });
  }
});
applyIdVirtual(RoleSchema);

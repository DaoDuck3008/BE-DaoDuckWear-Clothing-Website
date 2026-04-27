import { Schema } from 'mongoose';

/*
    File này dùng để thêm virtual id cho schema
    Khi query data thì sẽ có thêm id
    Khi update data thì sẽ không có versionKey
    Khi update data thì không có _id
    Khi update data thì không có _v
*/

export function applyIdVirtual(schema: Schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  });

  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  });
}

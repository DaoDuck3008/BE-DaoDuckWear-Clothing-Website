import 'dotenv/config';
import mongoose from 'mongoose';
import {
  OrderSchema,
  PaymentStatus,
} from '../../modules/orders/schemas/order.schema';

const OrderModel = mongoose.model('Order', OrderSchema);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Missing MONGODB_URI');

  await mongoose.connect(mongoUri);
  console.log('Đang backfill paidAt cho các đơn paymentStatus = PAID...');

  const result = await OrderModel.updateMany(
    {
      paymentStatus: PaymentStatus.PAID,
      $or: [{ paidAt: { $exists: false } }, { paidAt: null }],
    },
    [{ $set: { paidAt: '$updatedAt' } }],
  );

  console.log(
    `Đã cập nhật ${result.modifiedCount}/${result.matchedCount} đơn (paidAt = updatedAt).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

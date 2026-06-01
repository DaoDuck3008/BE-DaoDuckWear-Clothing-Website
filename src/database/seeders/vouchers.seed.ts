import 'dotenv/config';
import mongoose from 'mongoose';
import {
  VoucherSchema,
  DiscountType,
} from '../../modules/orders/schemas/voucher.schema';

const VoucherModel = mongoose.model('Voucher', VoucherSchema);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not defined');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  await VoucherModel.deleteMany({});

  const now = new Date();
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 ngày tới
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // hôm qua

  await VoucherModel.insertMany([
    {
      code: 'WELCOME50K',
      discountType: DiscountType.FIXED,
      discountValue: 50000,
      minOrderValue: 200000,
      usageLimit: 100,
      usedCount: 0,
      usedByUsers: [],
      expiredAt: futureDate,
    },
    {
      code: 'SUMMER20',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      maxDiscountAmount: 100000,
      minOrderValue: 300000,
      usageLimit: 50,
      usedCount: 0,
      usedByUsers: [],
      expiredAt: futureDate,
    },
    {
      code: 'FREESHIP',
      discountType: DiscountType.FIXED,
      discountValue: 30000,
      usageLimit: null, // không giới hạn lượt
      usedCount: 5,
      usedByUsers: [],
      expiredAt: futureDate,
    },
    {
      code: 'EXPIRED10',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      usageLimit: 200,
      usedCount: 0,
      usedByUsers: [],
      expiredAt: pastDate, // đã hết hạn
    },
    {
      code: 'FULLUSED',
      discountType: DiscountType.FIXED,
      discountValue: 100000,
      usageLimit: 5,
      usedCount: 5, // đã dùng hết lượt
      usedByUsers: [],
      expiredAt: futureDate,
    },
  ]);

  console.log('Seeded 5 vouchers');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

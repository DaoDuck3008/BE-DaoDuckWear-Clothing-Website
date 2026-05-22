import 'dotenv/config';
import mongoose from 'mongoose';
import { UserSchema } from '../../modules/users/schemas/user.schema';
import { RoleSchema } from '../../modules/roles/schemas/role.schema';
import { ShopSchema } from '../../modules/shops/schemas/shop.schema';
import { ProductSchema } from '../../modules/products/schemas/product.schema';
import { ProductVariantSchema } from '../../modules/products/schemas/product-variant.schema';
import { InventorySchema } from '../../modules/inventory/schemas/inventory.schema';
import { InventoryImportSchema } from '../../modules/inventory/schemas/inventory-import.schema';

const UserModel = mongoose.model('User', UserSchema);
const RoleModel = mongoose.model('Role', RoleSchema);
const ShopModel = mongoose.model('Shop', ShopSchema);
const ProductModel = mongoose.model('Product', ProductSchema);
const VariantModel = mongoose.model('ProductVariant', ProductVariantSchema);
const InventoryModel = mongoose.model('Inventory', InventorySchema);
const ImportModel = mongoose.model('InventoryImport', InventoryImportSchema);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Missing MONGODB_URI');

  await mongoose.connect(mongoUri);
  console.log('Bắt đầu seed phiếu nhập kho...');

  await ImportModel.deleteMany({});

  const shops = await ShopModel.find().lean();
  if (shops.length === 0) {
    console.log('Không có shop nào — bỏ qua seed phiếu nhập.');
    return;
  }

  const adminRole = await RoleModel.findOne({ name: 'ADMIN' }).lean();
  const managerRole = await RoleModel.findOne({ name: 'MANAGER' }).lean();
  const adminUser = adminRole
    ? await UserModel.findOne({ roleId: adminRole._id }).lean()
    : null;

  const products = await ProductModel.find({ deletedAt: null })
    .limit(5)
    .lean();
  if (products.length === 0) {
    console.log('Không có sản phẩm nào — bỏ qua seed phiếu nhập.');
    return;
  }

  let created = 0;

  for (const shop of shops) {
    const managerForShop = managerRole
      ? await UserModel.findOne({
          roleId: managerRole._id,
          shopId: shop._id,
        }).lean()
      : null;
    const actor = managerForShop || adminUser;
    if (!actor) {
      console.log(`Shop ${shop.name}: không tìm thấy user — bỏ qua.`);
      continue;
    }

    for (const product of products.slice(0, 3)) {
      const variants = await VariantModel.find({
        productId: product._id,
        deletedAt: null,
      }).lean();
      if (variants.length === 0) continue;

      const items = variants.slice(0, Math.min(3, variants.length)).map((v) => ({
        variantId: v._id,
        quantity: 10 + Math.floor(Math.random() * 20),
        sku: v.sku,
      }));
      const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

      const bulkOps = items.map((item) => ({
        updateOne: {
          filter: { shopId: shop._id, variantId: item.variantId },
          update: {
            $inc: { quantity: item.quantity },
            $setOnInsert: {
              shopId: shop._id,
              productId: product._id,
              variantId: item.variantId,
            },
          },
          upsert: true,
        },
      }));
      await InventoryModel.bulkWrite(bulkOps);

      await ImportModel.create({
        shopId: shop._id,
        productId: product._id,
        createdBy: actor._id,
        items,
        totalQuantity,
        status: 'ACTIVE',
        note: 'Phiếu nhập seed mẫu',
      });
      created += 1;
    }
  }

  console.log(`Đã tạo ${created} phiếu nhập mẫu.`);
}

main()
  .catch((error) => {
    console.error('Seed phiếu nhập thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

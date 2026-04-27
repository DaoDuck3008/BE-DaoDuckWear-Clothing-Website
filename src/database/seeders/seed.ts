import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { RoleSchema } from '../../modules/roles/schemas/role.schema';
import { UserSchema } from '../../modules/users/schemas/user.schema';
import { ShopSchema } from '../../modules/shops/schemas/shop.schema';
import { CategorySchema } from '../../modules/categories/schemas/category.schema';
import { ColorSchema } from '../../modules/colors/schemas/color.schema';

const RoleModel = mongoose.model('Role', RoleSchema);
const UserModel = mongoose.model('User', UserSchema);
const ShopModel = mongoose.model('Shop', ShopSchema);
const CategoryModel = mongoose.model('Category', CategorySchema);
const ColorModel = mongoose.model('Color', ColorSchema);

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI');
  }

  await mongoose.connect(mongoUri);
  console.log('Bắt đầu seed dữ liệu MongoDB...');

  await Promise.all([
    CategoryModel.deleteMany({}),
    UserModel.deleteMany({}),
    RoleModel.deleteMany({}),
    ShopModel.deleteMany({}),
    ColorModel.deleteMany({}),
  ]);

  const shopsData = [
    {
      name: 'DaoDuck Wear - Chi nhánh Hà Nội',
      slug: 'daoduck-hanoi',
      cityName: 'Hà Nội',
      cityCode: 1,
    },
    {
      name: 'DaoDuck Wear - Chi nhánh TP.HCM',
      slug: 'daoduck-hcm',
      cityName: 'TP. Hồ Chí Minh',
      cityCode: 79,
    },
    {
      name: 'DaoDuck Wear - Chi nhánh Đà Nẵng',
      slug: 'daoduck-danang',
      cityName: 'Đà Nẵng',
      cityCode: 48,
    },
  ];

  await ShopModel.insertMany(shopsData);

  const roles = await RoleModel.insertMany(
    ['USER', 'STAFF', 'MANAGER', 'ADMIN'].map((name) => ({ name })),
  );
  const roleMap = new Map(roles.map((role) => [role.name, role._id]));

  const passwordHash = await bcrypt.hash('123456', 10);
  const usersToCreate = [
    { username: 'admin', email: 'admin@daoduck.com', role: 'ADMIN' },
    { username: 'manager', email: 'manager@daoduck.com', role: 'MANAGER' },
    { username: 'staff', email: 'staff@daoduck.com', role: 'STAFF' },
  ];

  await UserModel.insertMany(
    usersToCreate.map((user) => ({
      username: user.username,
      email: user.email,
      password: passwordHash,
      roleId: roleMap.get(user.role),
      addresses: [],
    })),
  );

  await UserModel.insertMany(
    Array.from({ length: 7 }, (_, index) => ({
      username: `user${index + 1}`,
      email: `user${index + 1}@daoduck.com`,
      password: passwordHash,
      roleId: roleMap.get('USER'),
      addresses: [],
    })),
  );

  const categoriesData = [
    { name: 'Áo', parentName: null },
    { name: 'Áo sơ mi', parentName: 'Áo' },
    { name: 'Áo thun', parentName: 'Áo' },
    { name: 'Polo', parentName: 'Áo' },
    { name: 'Blazer', parentName: 'Áo' },
    { name: 'Outerwear', parentName: 'Áo' },
    { name: 'Quần', parentName: null },
    { name: 'Quần âu', parentName: 'Quần' },
    { name: 'Quần kaki', parentName: 'Quần' },
    { name: 'Quần jean', parentName: 'Quần' },
    { name: 'Quần short', parentName: 'Quần' },
    { name: 'Phụ kiện', parentName: null },
    { name: 'Thắt lưng', parentName: 'Phụ kiện' },
    { name: 'Ví', parentName: 'Phụ kiện' },
    { name: 'Cà vạt', parentName: 'Phụ kiện' },
    { name: 'Bộ sưu tập', parentName: null },
    { name: 'New Arrival', parentName: 'Bộ sưu tập' },
    { name: 'Best Seller', parentName: 'Bộ sưu tập' },
    { name: 'Sale', parentName: 'Bộ sưu tập' },
  ];

  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  for (const category of categoriesData.filter((item) => !item.parentName)) {
    const created = await CategoryModel.create({
      name: category.name,
      slug: slugify(category.name),
    });
    categoryMap.set(category.name, created._id);
  }

  for (const category of categoriesData.filter((item) => item.parentName)) {
    const parentId = categoryMap.get(category.parentName as string);
    const created = await CategoryModel.create({
      name: category.name,
      slug: slugify(category.name),
      parentId,
    });
    categoryMap.set(category.name, created._id);
  }

  const colorsData = [
    { name: 'Đen', slug: 'den', hexCode: '#000000' },
    { name: 'Trắng', slug: 'trang', hexCode: '#FFFFFF' },
    { name: 'Navy', slug: 'navy', hexCode: '#1B2A49' },
    { name: 'Xám', slug: 'xam', hexCode: '#808080' },
    { name: 'Xám Đậm', slug: 'xam-dam', hexCode: '#555555' },
    { name: 'Xám Nhạt', slug: 'xam-nhat', hexCode: '#BFC3C7' },
    { name: 'Be', slug: 'be', hexCode: '#D8D0C5' },
    { name: 'Kem', slug: 'kem', hexCode: '#F4EBD0' },
    { name: 'Nâu', slug: 'nau', hexCode: '#6B4F3A' },
    { name: 'Nâu Gỗ Sồi', slug: 'nau-go-soi', hexCode: '#8B5A2B' },
    { name: 'Nâu Đậm', slug: 'nau-dam', hexCode: '#4A3426' },
    { name: 'Đỏ', slug: 'do', hexCode: '#B22222' },
    { name: 'Đỏ Maroon', slug: 'do-maroon', hexCode: '#800000' },
    { name: 'Xanh Rêu', slug: 'xanh-reu', hexCode: '#556B2F' },
    { name: 'Xanh Lá', slug: 'xanh-la', hexCode: '#2E8B57' },
    { name: 'Xanh Dương', slug: 'xanh-duong', hexCode: '#1565C0' },
    { name: 'Xanh Da Trời', slug: 'xanh-da-troi', hexCode: '#87CEEB' },
    { name: 'Vàng', slug: 'vang', hexCode: '#D4AF37' },
    { name: 'Cam', slug: 'cam', hexCode: '#E67E22' },
    { name: 'Tím', slug: 'tim', hexCode: '#6A0DAD' },
  ];

  await ColorModel.insertMany(colorsData);
  console.log('Seed dữ liệu MongoDB thành công.');
}

main()
  .catch((error) => {
    console.error('Seed dữ liệu MongoDB thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

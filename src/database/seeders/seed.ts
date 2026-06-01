import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { RoleSchema } from '../../modules/roles/schemas/role.schema';
import { UserSchema } from '../../modules/users/schemas/user.schema';
import { ShopSchema } from '../../modules/shops/schemas/shop.schema';
import { CategorySchema } from '../../modules/categories/schemas/category.schema';
import { ColorSchema } from '../../modules/colors/schemas/color.schema';
import { ConversationSchema } from '../../modules/chat/schemas/conversation.schema';
import { MessageSchema } from '../../modules/chat/schemas/message.schema';

const RoleModel = mongoose.model('Role', RoleSchema);
const UserModel = mongoose.model('User', UserSchema);
const ShopModel = mongoose.model('Shop', ShopSchema);
const CategoryModel = mongoose.model('Category', CategorySchema);
const ColorModel = mongoose.model('Color', ColorSchema);
const ConversationModel = mongoose.model('Conversation', ConversationSchema);
const MessageModel = mongoose.model('Message', MessageSchema);

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
    ConversationModel.deleteMany({}),
    MessageModel.deleteMany({}),
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

  const shops = await ShopModel.insertMany(shopsData);
  const shopBySlug = new Map(shops.map((s) => [s.slug, s._id]));
  const defaultShopId = shopBySlug.get('daoduck-hanoi');

  const roles = await RoleModel.insertMany(
    ['USER', 'STAFF', 'MANAGER', 'ADMIN', 'RECEPTIONIST'].map((name) => ({
      name,
    })),
  );
  const roleMap = new Map(roles.map((role) => [role.name, role._id]));

  const passwordHash = await bcrypt.hash('123456', 10);
  const usersToCreate = [
    {
      username: 'admin',
      email: 'admin@daoduck.com',
      role: 'ADMIN',
      shopId: null,
      fullName: 'Quản trị viên',
      position: 'Quản trị hệ thống',
      hireDate: new Date('2024-01-01'),
      employmentStatus: 'active',
    },
    {
      username: 'manager',
      email: 'manager@daoduck.com',
      role: 'MANAGER',
      shopId: defaultShopId,
      fullName: 'Nguyễn Văn Quản',
      position: 'Quản lý chi nhánh',
      hireDate: new Date('2024-02-01'),
      employmentStatus: 'active',
    },
    {
      username: 'staff',
      email: 'staff@daoduck.com',
      role: 'STAFF',
      shopId: defaultShopId,
      fullName: 'Trần Thị Nhân',
      position: 'Nhân viên bán hàng',
      hireDate: new Date('2024-03-15'),
      employmentStatus: 'active',
    },
    {
      username: 'receptionist',
      email: 'receptionist@daoduck.com',
      role: 'RECEPTIONIST',
      shopId: defaultShopId,
      fullName: 'Lê Thị Lễ Tân',
      position: 'Lễ tân / Chăm sóc khách hàng',
      hireDate: new Date('2024-04-01'),
      employmentStatus: 'active',
    },
  ];

  await UserModel.insertMany(
    usersToCreate.map((user) => ({
      username: user.username,
      email: user.email,
      password: passwordHash,
      roleId: roleMap.get(user.role),
      shopId: user.shopId,
      addresses: [],
      isVerified: true,
      fullName: user.fullName,
      position: user.position,
      hireDate: user.hireDate,
      employmentStatus: user.employmentStatus,
    })),
  );

  const customers = await UserModel.insertMany(
    Array.from({ length: 7 }, (_, index) => ({
      username: `user${index + 1}`,
      email: `user${index + 1}@daoduck.com`,
      password: passwordHash,
      roleId: roleMap.get('USER'),
      addresses: [],
      isVerified: true,
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

  // Hội thoại chat mẫu giữa user1 và chi nhánh Hà Nội
  if (customers[0] && defaultShopId) {
    const now = Date.now();
    const conversation = await ConversationModel.create({
      customerId: customers[0]._id,
      shopId: defaultShopId,
      lastMessage: 'Dạ bên em còn size M màu đen ạ.',
      lastMessageAt: new Date(now),
      customerUnread: 1,
      shopUnread: 0,
    });

    const receptionist = await UserModel.findOne({
      email: 'receptionist@daoduck.com',
    });

    await MessageModel.insertMany([
      {
        conversationId: conversation._id,
        senderId: customers[0]._id,
        senderType: 'customer',
        content: 'Chào shop, áo sơ mi này còn size M không ạ?',
        createdAt: new Date(now - 60_000),
        updatedAt: new Date(now - 60_000),
      },
      {
        conversationId: conversation._id,
        senderId: receptionist?._id ?? customers[0]._id,
        senderType: 'shop',
        content: 'Dạ bên em còn size M màu đen ạ.',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ]);
  }

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

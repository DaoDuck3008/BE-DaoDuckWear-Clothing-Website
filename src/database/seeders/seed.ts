// src/database/seeders/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Đang bắt đầu Seed dữ liệu...');

  try {
    // 1. Xóa dữ liệu cũ (Tùy chọn, cẩn thận khi dùng)
    console.log('- Đang xóa dữ liệu cũ...');
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.shop.deleteMany();
    await prisma.color.deleteMany();

    // 2. Seed Shops
    console.log('- Đang tạo shops...');
    const shopsData = [
      { name: 'DaoDuck Wear - Chi nhánh Hà Nội', slug: 'daoduck-hanoi', cityName: 'Hà Nội', cityCode: 1 },
      { name: 'DaoDuck Wear - Chi nhánh TP.HCM', slug: 'daoduck-hcm', cityName: 'TP. Hồ Chí Minh', cityCode: 79 },
      { name: 'DaoDuck Wear - Chi nhánh Đà Nẵng', slug: 'daoduck-danang', cityName: 'Đà Nẵng', cityCode: 48 },
    ];

    const shopMap = new Map<string, string>();
    for (const s of shopsData) {
      const created = await prisma.shop.create({ data: s });
      shopMap.set(s.slug, created.id);
    }
    console.log('- Đang tạo roles...');
    const roles = ['USER', 'STAFF', 'MANAGER', 'ADMIN'];
    const roleMap = new Map<string, string>();

    for (const roleName of roles) {
      const createdRole = await prisma.role.create({
        data: { name: roleName },
      });
      roleMap.set(roleName, createdRole.id);
    }

    // 3. Seed Users
    const passwordHash = await bcrypt.hash('123456', 10);
    console.log('- Đang tạo users...');
    
    // Tạo 1 ADMIN, 1 MANAGER, 1 STAFF và các USER
    const usersToCreate = [
      { username: 'admin', email: 'admin@daoduck.com', role: 'ADMIN' },
      { username: 'manager', email: 'manager@daoduck.com', role: 'MANAGER' },
      { username: 'staff', email: 'staff@daoduck.com', role: 'STAFF' },
    ];

    for (const u of usersToCreate) {
      await prisma.user.create({
        data: {
          username: u.username,
          email: u.email,
          password: passwordHash,
          roleId: roleMap.get(u.role),
        },
      });
    }

    // Tạo thêm 7 users bình thường
    for (let i = 1; i <= 7; i++) {
      await prisma.user.create({
        data: {
          username: `user${i}`,
          email: `user${i}@daoduck.com`,
          password: passwordHash,
          roleId: roleMap.get('USER'),
        },
      });
    }

    // 4. Seed Categories
    console.log('- Đang tạo categories...');
    const categoriesData = [
      { name: 'Áo', parentId: null },
      { name: 'Áo sơ mi', parentId: 'Áo' },
      { name: 'Áo thun', parentId: 'Áo' },
      { name: 'Polo', parentId: 'Áo' },
      { name: 'Blazer', parentId: 'Áo' },
      { name: 'Outerwear', parentId: 'Áo' },
      { name: 'Quần', parentId: null },
      { name: 'Quần âu', parentId: 'Quần' },
      { name: 'Quần kaki', parentId: 'Quần' },
      { name: 'Quần jean', parentId: 'Quần' },
      { name: 'Quần short', parentId: 'Quần' },
      { name: 'Phụ kiện', parentId: null },
      { name: 'Thắt lưng', parentId: 'Phụ kiện' },
      { name: 'Ví', parentId: 'Phụ kiện' },
      { name: 'Cà vạt', parentId: 'Phụ kiện' },
      { name: 'Bộ sưu tập', parentId: null },
      { name: 'New Arrival', parentId: 'Bộ sưu tập' },
      { name: 'Best Seller', parentId: 'Bộ sưu tập' },
      { name: 'Sale', parentId: 'Bộ sưu tập' },
    ];

    const categoryMap = new Map<string, string>();

    // Pass 1: Tạo các category cha (parentId == null)
    const parents = categoriesData.filter((c) => c.parentId === null);
    for (const p of parents) {
      const created = await prisma.category.create({
        data: { name: p.name },
      });
      categoryMap.set(p.name, created.id);
    }

    // Pass 2: Tạo các category con
    const children = categoriesData.filter((c) => c.parentId !== null);
    for (const c of children) {
      const pId = categoryMap.get(c.parentId as string);
      if (pId) {
        await prisma.category.create({
          data: {
            name: c.name,
            parentId: pId,
          },
        });
      }
    }

    // 5. Seed Colors
    console.log('- Đang tạo colors...');
    const colorsData = [
      { "name": "Đen", "slug": "den", "hexCode": "#000000" },
      { "name": "Trắng", "slug": "trang", "hexCode": "#FFFFFF" },
      { "name": "Navy", "slug": "navy", "hexCode": "#1B2A49" },
      { "name": "Xám", "slug": "xam", "hexCode": "#808080" },
      { "name": "Xám Đậm", "slug": "xam-dam", "hexCode": "#555555" },
      { "name": "Xám Nhạt", "slug": "xam-nhat", "hexCode": "#BFC3C7" },
      { "name": "Be", "slug": "be", "hexCode": "#D8D0C5" },
      { "name": "Kem", "slug": "kem", "hexCode": "#F4EBD0" },
      { "name": "Nâu", "slug": "nau", "hexCode": "#6B4F3A" },
      { "name": "Nâu Gỗ Sồi", "slug": "nau-go-soi", "hexCode": "#8B5A2B" },
      { "name": "Nâu Đậm", "slug": "nau-dam", "hexCode": "#4A3426" },
      { "name": "Đỏ", "slug": "do", "hexCode": "#B22222" },
      { "name": "Đỏ Maroon", "slug": "do-maroon", "hexCode": "#800000" },
      { "name": "Xanh Rêu", "slug": "xanh-reu", "hexCode": "#556B2F" },
      { "name": "Xanh Lá", "slug": "xanh-la", "hexCode": "#2E8B57" },
      { "name": "Xanh Dương", "slug": "xanh-duong", "hexCode": "#1565C0" },
      { "name": "Xanh Da Trời", "slug": "xanh-da-troi", "hexCode": "#87CEEB" },
      { "name": "Vàng", "slug": "vang", "hexCode": "#D4AF37" },
      { "name": "Cam", "slug": "cam", "hexCode": "#E67E22" },
      { "name": "Tím", "slug": "tim", "hexCode": "#6A0DAD" }
    ];

    for (const color of colorsData) {
      await prisma.color.create({
        data: color,
      });
    }

    console.log('✅ Seed hoàn tất thành công!');
  } catch (error) {
    console.error('❌ Lỗi seeding:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

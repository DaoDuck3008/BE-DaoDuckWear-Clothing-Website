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
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    // 2. Seed Users
    const passwordHash = await bcrypt.hash('123456', 10);
    console.log('- Đang tạo users...');
    for (let i = 1; i <= 10; i++) {
      await prisma.user.create({
        data: {
          username: `user${i}`,
          email: `user${i}@daoduck.com`,
          password: passwordHash,
          role: i === 1 ? 'ADMIN' : 'USER',
        },
      });
    }

    // 3. Seed Categories
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

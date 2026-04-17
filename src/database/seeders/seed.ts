// src/database/seeders/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Đang bắt đầu Seed với Adapter PG...');

  try {
    await prisma.user.deleteMany();
    const passwordHash = await bcrypt.hash('123456', 10);

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

    console.log('✅ Seed hoàn tất thành công!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
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

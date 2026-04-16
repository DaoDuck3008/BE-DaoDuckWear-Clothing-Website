// src/database/seeders/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Đang bắt đầu Seed với Adapter PG...');

  try {
    await prisma.user.deleteMany();
    const passwordHash = await bcrypt.hash('123456', 10);

    for (let i = 1; i <= 10; i++) {
      await prisma.user.create({
        data: {
          email: `user${i}@daoduck.com`,
          password: passwordHash,
          role: i === 1 ? 'admin' : 'user',
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
    await pool.end();
  });

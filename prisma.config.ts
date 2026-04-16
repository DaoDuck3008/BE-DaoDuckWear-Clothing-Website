import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'src/database/prisma/schema.prisma',
  migrations: {
    path: 'src/database/migrations',
    seed: 'tsx src/database/seeders/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

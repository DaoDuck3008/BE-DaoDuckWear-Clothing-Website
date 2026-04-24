import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { ShopsModule } from './modules/shops/shops.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ColorsModule } from './modules/colors/colors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CloudinaryModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    ShopsModule,
    FavoritesModule,
    ColorsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

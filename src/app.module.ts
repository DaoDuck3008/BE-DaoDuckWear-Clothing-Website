import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { ShopsModule } from './modules/shops/shops.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ColorsModule } from './modules/colors/colors.module';
import { DatabaseModule } from './database/database.module';
import { RolesModule } from './modules/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    RolesModule,
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

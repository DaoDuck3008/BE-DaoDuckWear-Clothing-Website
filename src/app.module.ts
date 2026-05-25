import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ResilientThrottlerGuard } from './common/guards/resilient-throttler.guard';
import { createThrottlerOptions } from './config/rateLimit.config';
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
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BannersModule } from './modules/banners/banners.module';
import { MailModule } from './modules/mail/mail.module';
import { RedisModule } from './modules/redis/redis.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    RedisModule,
    ThrottlerModule.forRoot(createThrottlerOptions()),
    RolesModule,
    AuthModule,
    UsersModule,
    CloudinaryModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CartModule,
    ShopsModule,
    FavoritesModule,
    ColorsModule,
    OrdersModule,
    BannersModule,
    MailModule,
    HealthModule,
    AnalyticsModule,
    ReviewsModule,
    VouchersModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ResilientThrottlerGuard }],
})
export class AppModule {}

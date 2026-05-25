import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from '../products/schemas/product-variant.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { CartService } from '../cart/cart.service';
import { Shop, ShopSchema } from '../shops/schemas/shop.schema';
import { MailModule } from '../mail/mail.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MailModule,
    VouchersModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Cart.name, schema: CartSchema },
      { name: Shop.name, schema: ShopSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, CartService],
  exports: [OrdersService],
})
export class OrdersModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from './schemas/product-variant.schema';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import { Shop, ShopSchema } from '../shops/schemas/shop.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Shop.name, schema: ShopSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}

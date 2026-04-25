import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { Shop, ShopSchema } from './schemas/shop.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Shop.name, schema: ShopSchema }]),
  ],
  controllers: [ShopsController],
  providers: [ShopsService],
})
export class ShopsModule {}

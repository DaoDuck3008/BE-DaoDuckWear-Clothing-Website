import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shop, ShopDocument } from './schemas/shop.schema';

@Injectable()
export class ShopsService {
  constructor(
    @InjectModel(Shop.name) private readonly shopModel: Model<ShopDocument>,
  ) {}

  async findAll() {
    return this.shopModel.find({ deletedAt: null }).sort({ name: -1 });
  }
}

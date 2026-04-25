import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './schemas/favorite.schema';
import { Product } from '../products/schemas/product.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<any>,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
  ) {}

  async getFavorites(userId: string) {
    const favorites = await this.favoriteModel
      .find({ userId: this.toObjectId(userId) })
      .sort({ createdAt: -1 });

    return Promise.all(
      favorites.map(async (favorite) => ({
        ...favorite.toJSON(),
        product: await this.mapFavoriteProduct(favorite.productId.toString()),
      })),
    );
  }

  async addFavorite(userId: string, productId: string) {
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    try {
      const favorite = await this.favoriteModel.create({
        userId: this.toObjectId(userId),
        productId: this.toObjectId(productId),
      });

      return {
        ...favorite.toJSON(),
        product: this.mapProduct(product),
      };
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Sản phẩm đã có trong danh sách yêu thích');
      }
      throw error;
    }
  }

  async removeFavorite(userId: string, productId: string) {
    const favorite = await this.favoriteModel.findOneAndDelete({
      userId: this.toObjectId(userId),
      productId: this.toObjectId(productId),
    });

    if (!favorite) {
      throw new NotFoundException(
        'Sản phẩm không có trong danh sách yêu thích',
      );
    }

    return favorite;
  }

  async clearFavorites(userId: string): Promise<any> {
    return this.favoriteModel.deleteMany({ userId: this.toObjectId(userId) });
  }

  async checkIsFavorite(userId: string, productId: string) {
    const favorite = await this.favoriteModel.exists({
      userId: this.toObjectId(userId),
      productId: this.toObjectId(productId),
    });
    return !!favorite;
  }

  private async mapFavoriteProduct(productId: string) {
    const product = await this.productModel.findById(productId);
    if (!product) return null;
    return this.mapProduct(product);
  }

  private mapProduct(product: any) {
    const productJson = product.toJSON() as Record<string, any>;
    return {
      ...productJson,
      images: product.images.filter((image) => image.isMain).slice(0, 1),
    };
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

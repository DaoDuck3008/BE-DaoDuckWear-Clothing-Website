import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { Cart } from './schemas/cart.schema';
import { ProductVariant } from '../products/schemas/product-variant.schema';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../products/schemas/inventory.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<any>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<any>,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<any>,
  ) {}

  async getCart(userId: string) {
    let cart = await this.cartModel.findOne({
      userId: this.toObjectId(userId),
    });

    if (!cart) {
      cart = await this.cartModel.create({
        userId: this.toObjectId(userId),
        items: [],
      });
    }

    return this.mapCart(cart);
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const { variantId, quantity } = dto;
    const cart = await this.ensureCart(userId);

    const variant = await this.variantModel.findById(variantId);

    if (!variant) {
      throw new NotFoundException('Không tìm thấy sản phẩm này');
    }

    const availableStock = await this.getAvailableStock(variantId);
    const existingItem = cart.items.find(
      (item: any) => item.variantId.toString() === variantId,
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    if (newQuantity > availableStock) {
      throw new BadRequestException(
        `Không đủ hàng trong kho. Còn lại: ${availableStock}`,
      );
    }

    if (newQuantity > 100) {
      throw new BadRequestException('Số lượng tối đa trong giỏ hàng là 100');
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        variantId: this.toObjectId(variantId),
        quantity: newQuantity,
      } as any);
    }

    await cart.save();
    const mappedCart = await this.mapCart(cart);
    return mappedCart.items.find((item: any) => item.variantId === variantId);
  }

  async updateQuantity(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const { quantity } = dto;
    const cart = await this.cartModel.findOne({
      userId: this.toObjectId(userId),
    });

    if (!cart) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    const item = cart.items.find((cartItem: any) => cartItem.id === itemId);

    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    const availableStock = await this.getAvailableStock(
      item.variantId.toString(),
    );
    if (quantity > availableStock) {
      throw new BadRequestException(
        `Không đủ hàng trong kho. Còn lại: ${availableStock}`,
      );
    }

    item.quantity = quantity;
    await cart.save();
    const mappedCart = await this.mapCart(cart);
    return mappedCart.items.find((mappedItem: any) => mappedItem.id === itemId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.cartModel.findOne({
      userId: this.toObjectId(userId),
    });

    if (!cart) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    const item = cart.items.find((cartItem: any) => cartItem.id === itemId);

    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    cart.items = cart.items.filter((cartItem: any) => cartItem.id !== itemId);
    await cart.save();
    return item;
  }

  async clearCart(userId: string) {
    return this.cartModel.updateOne(
      { userId: this.toObjectId(userId) },
      { $set: { items: [] } },
    );
  }

  private async ensureCart(userId: string) {
    const objectUserId = this.toObjectId(userId);
    let cart = await this.cartModel.findOne({ userId: objectUserId });
    if (!cart) {
      cart = await this.cartModel.create({ userId: objectUserId, items: [] });
    }
    return cart;
  }

  private async getAvailableStock(variantId: string) {
    const inventories = await this.inventoryModel.find({
      variantId: this.toObjectId(variantId),
    });

    return inventories.reduce(
      (total, inventory) =>
        total + Math.max(inventory.quantity - inventory.reservedQuantity, 0),
      0,
    );
  }

  private async mapCart(cart: any) {
    const items = await Promise.all(
      cart.items.map(async (item: any) => {
        const variant = await this.variantModel.findById(item.variantId);
        if (!variant) return null;

        const product = await this.productModel.findById(variant.productId);
        if (!product) return null;

        return {
          id: item.id,
          variantId: variant.id,
          quantity: item.quantity,
          variant: {
            id: variant.id,
            price: variant.price,
            color: variant.color,
            size: variant.size,
            productId: product.id,
            product: {
              name: product.name,
              slug: product.slug,
              images: product.images.map((image: any) => ({
                url: image.url,
                color: image.color,
              })),
            },
          },
        };
      }),
    );

    return {
      id: cart.id,
      userId: cart.userId.toString(),
      items: items.filter(Boolean),
    };
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

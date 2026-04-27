import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { Cart } from './schemas/cart.schema';
import { ProductVariant } from '../products/schemas/product-variant.schema';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../products/schemas/inventory.schema';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Shop } from '../shops/schemas/shop.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<any>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<any>,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<any>,
    @InjectModel(Shop.name)
    private readonly shopModel: Model<any>,
  ) {}

  async getCart(userId: string) {
    const cart = await this.ensureCart(userId);
    return this.mapCart(cart);
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const { variantId, quantity, shopId } = dto;
    const cart = await this.ensureCart(userId);

    const variantDoc = await this.variantModel.findById(variantId);
    if (!variantDoc) {
      throw new NotFoundException('Không tìm thấy sản phẩm này');
    }

    // Kiểm tra tồn kho tại chi nhánh đã chọn
    const inventory = await this.inventoryModel.findOne({
      variantId: this.toObjectId(variantId),
      shopId: this.toObjectId(shopId),
    });

    if (!inventory) {
      throw new BusinessException(
        'Sản phẩm không tồn tại ở chi nhánh này',
        'PRODUCT_NOT_FOUND_IN_SHOP',
      );
    }

    const realStock = inventory.stock - inventory.reservedQuantity;

    if (realStock < quantity) {
      throw new BusinessException(
        'Sản phẩm đã hết hàng hoặc không đủ số lượng tại chi nhánh này',
        'OUT_OF_STOCK',
      );
    }

    // Tìm xem đã có sản phẩm này từ cùng 1 shop trong giỏ chưa
    const existingItem = cart.items.find(
      (item: any) =>
        item.variantId?.toString() === variantId &&
        item.shopId?.toString() === shopId,
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > realStock) {
        throw new BusinessException(
          'Số lượng trong giỏ vượt quá tồn kho hiện có',
          'OUT_OF_STOCK',
        );
      }
    } else {
      cart.items.push({
        variantId: this.toObjectId(variantId),
        shopId: this.toObjectId(shopId),
        quantity,
      });
    }

    await cart.save();
    return this.getCart(userId);
  }

  async updateQuantity(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const { quantity } = dto;
    const cart = await this.ensureCart(userId);

    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    // Kiểm tra tồn kho
    const inventory = await this.inventoryModel.findOne({
      variantId: item.variantId,
      shopId: item.shopId,
    });

    if (!inventory) {
      throw new BusinessException(
        'Sản phẩm không tồn tại ở chi nhánh này',
        'PRODUCT_NOT_FOUND_IN_SHOP',
      );
    }

    const realStock = inventory.stock - inventory.reservedQuantity;

    if (realStock < quantity) {
      throw new BusinessException('Số lượng tồn kho không đủ', 'OUT_OF_STOCK');
    }

    item.quantity = quantity;
    await cart.save();
    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string) {
    const cart = await this.ensureCart(userId);
    cart.items = cart.items.filter((i: any) => i._id?.toString() !== itemId);
    await cart.save();
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.ensureCart(userId);
    cart.items = [];
    await cart.save();
    return true;
  }

  private async ensureCart(userId: string) {
    const objectUserId = this.toObjectId(userId);
    let cart = await this.cartModel
      .findOne({ userId: objectUserId })
      .populate('items.variantId items.shopId');

    if (!cart) {
      cart = await this.cartModel.create({ userId: objectUserId, items: [] });
      // Reload to have populated fields
      return this.cartModel
        .findById(cart._id)
        .populate('items.variantId items.shopId');
    }
    return cart;
  }

  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  private async mapCart(cart: any) {
    const items = await Promise.all(
      cart.items.map(async (item: any) => {
        const variant = item.variantId;
        const shop = item.shopId;

        if (!variant || !variant._id) return null;

        const product = await this.productModel.findById(variant.productId);
        if (!product) return null;

        return {
          id: item._id.toString(),
          variantId: variant._id.toString(),
          productId: variant.productId.toString(),
          quantity: item.quantity,
          shopId: shop?._id?.toString() || item.shopId?.toString(),
          shopName: shop?.name || 'Chi nhánh mặc định',
          name: product.name,
          price: variant.price,
          size: variant.size,
          color: variant.color,
          slug: product.slug,
          image:
            variant.image ||
            (product.images?.[0]?.url
              ? product.images[0].url
              : typeof product.images?.[0] === 'string'
                ? product.images[0]
                : ''),
        };
      }),
    );

    const filteredItems = items.filter((i) => i !== null);
    const totalPrice = filteredItems.reduce(
      (total, item: any) => total + item.price * item.quantity,
      0,
    );

    return {
      items: filteredItems,
      totalPrice,
      cartId: cart._id.toString(),
    };
  }
}

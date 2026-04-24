import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // Định nghĩa select chung để tái sử dụng
  private readonly cartItemSelect = {
    id: true,
    variantId: true,
    quantity: true,
    variant: {
      select: {
        id: true,
        price: true,
        color: true,
        size: true,
        productId: true,
        product: {
          select: {
            name: true,
            slug: true,
            images: {
              select: {
                url: true,
                color: true,
              },
            },
          },
        },
      },
    },
  };

  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        items: {
          select: this.cartItemSelect,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        select: {
          id: true,
          userId: true,
          items: {
            select: this.cartItemSelect,
          },
        },
      });
    }

    return cart;
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const { variantId, quantity } = dto;
    const cart = await this.getCart(userId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        inventories: { select: { quantity: true } },
      },
    });

    if (!variant) {
      throw new NotFoundException('Không tìm thấy sản phẩm này');
    }

    // Tính tổng số lượng hàng tồn kho từ tất cả các kho
    const availableStock = variant.inventories.reduce(
      (total, inventory) => total + inventory.quantity,
      0,
    );

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
      select: { id: true, quantity: true },
    });

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

    return this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
      update: { quantity: newQuantity },
      create: {
        cartId: cart.id,
        variantId,
        quantity: newQuantity,
      },
      select: this.cartItemSelect,
    });
  }

  async updateQuantity(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const { quantity } = dto;

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      select: {
        cart: { select: { userId: true } },
        variant: { select: { inventories: { select: { quantity: true } } } },
      },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    const availableStock = item.variant.inventories.reduce(
      (total, inventory) => total + inventory.quantity,
      0,
    );
    if (quantity > availableStock) {
      throw new BadRequestException(
        `Không đủ hàng trong kho. Còn lại: ${availableStock}`,
      );
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      select: this.cartItemSelect,
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { cart: { select: { userId: true } } },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng');
    }

    return this.prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) return;

    return this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
  }
}

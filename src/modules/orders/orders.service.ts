import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../products/schemas/product-variant.schema';
import {
  Inventory,
  InventoryDocument,
} from '../products/schemas/inventory.schema';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { CreateOrderDto } from './dto/create-order.dto';
import { generateUniqueHex } from 'src/common/utils/crypto.util';
import { formatDateCode } from 'src/common/utils/date.util';

import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private variantModel: Model<ProductVariantDocument>,
    @InjectModel(Inventory.name)
    private inventoryModel: Model<InventoryDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly cartService: CartService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const { shippingAddress, paymentMethod } = createOrderDto;

      // 1. Fetch Cart and validate
      const cart = await this.cartService.getCart(userId);

      const snapshotItems: any[] = [];
      let totalAmount = 0;

      // 2. Validate items from cart and build snapshot
      for (const cartItem of cart.items) {
        const product = await this.productModel
          .findById(cartItem.productId)
          .session(session);
        const variant = await this.variantModel
          .findById(cartItem.variantId)
          .session(session);

        if (
          !product ||
          !variant ||
          variant.productId.toString() !== product._id.toString()
        ) {
          throw new NotFoundException(
            `Sản phẩm ${cartItem.productId} không hợp lệ`,
          );
        }

        // Check Inventory SPECIFIC to the shop linked to this item
        const inventory = await this.inventoryModel
          .findOne({
            variantId: variant._id,
            shopId: cartItem.shopId,
          })
          .session(session);

        if (
          !inventory ||
          inventory.quantity - inventory.reservedQuantity < cartItem.quantity
        ) {
          throw new BusinessException(
            `Sản phẩm ${product.name} - ${variant.size}/${variant.color} tại chi nhánh đã hết hàng`,
            'BUSINESS_ERROR',
          );
        }

        // Reserve stock
        inventory.reservedQuantity += cartItem.quantity;
        await inventory.save({ session });

        // Build snapshot
        const itemPrice = variant.price || product.basePrice;
        totalAmount += itemPrice * cartItem.quantity;

        snapshotItems.push({
          productId: product._id,
          variantId: variant._id,
          shopId: cartItem.shopId,
          name: product.name,
          image:
            product.images.find((img) => img.isMain)?.url ||
            product.images[0]?.url,
          size: variant.size,
          color: variant.color,
          price: itemPrice,
          quantity: cartItem.quantity,
        });
      }

      const shippingFee = 30000;
      const finalTotal = totalAmount + shippingFee;
      const orderCode = `DDW-${formatDateCode()}-${generateUniqueHex()}`;

      // 3. Create Order
      const newOrder = new this.orderModel({
        orderCode,
        userId: userId ? new Types.ObjectId(userId) : null,
        shippingAddress,
        items: snapshotItems,
        totalAmount,
        shippingFee,
        finalTotal,
        paymentMethod,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
      });

      await newOrder.save({ session });

      // 4. Delete Cart after successful order
      await this.cartService.clearCart(userId);

      await session.commitTransaction();
      return newOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findMyOrders(userId: string) {
    return this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');
    return order;
  }
}

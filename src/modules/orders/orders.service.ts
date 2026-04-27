import { Injectable, BadRequestException } from '@nestjs/common';
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
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId?: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const { items, shippingAddress, paymentMethod } = createOrderDto;
      const snapshotItems: any[] = [];
      let totalAmount = 0;

      // 1. Validate items and build snapshot
      for (const item of items) {
        const product = await this.productModel
          .findById(item.productId)
          .session(session);
        const variant = await this.variantModel
          .findById(item.variantId)
          .session(session);

        if (
          !product ||
          !variant ||
          variant.productId.toString() !== product._id.toString()
        ) {
          throw new BusinessException(
            `Sản phẩm không hợp lệ`,
            'BUSINESS_ERROR',
          );
        }

        // Check Inventory SPECIFIC to the shop linked to this item
        const inventory = await this.inventoryModel
          .findOne({
            variantId: variant._id,
            shopId: new Types.ObjectId(item.shopId),
          })
          .session(session);

        if (!inventory || inventory.quantity < item.quantity) {
          throw new BusinessException(
            `Sản phẩm ${product.name} - ${variant.size}/${variant.color} tại chi nhánh đã hết hàng`,
            'BUSINESS_ERROR',
          );
        }

        // Deduct stock from the specific shop
        inventory.quantity -= item.quantity;
        await inventory.save({ session });

        // Build snapshot
        const itemPrice = variant.price || product.basePrice;
        totalAmount += itemPrice * item.quantity;

        snapshotItems.push({
          productId: product._id,
          variantId: variant._id,
          shopId: new Types.ObjectId(item.shopId),
          name: product.name,
          image:
            product.images.find((img) => img.isMain)?.url ||
            product.images[0]?.url,
          size: variant.size,
          color: variant.color,
          price: itemPrice,
          quantity: item.quantity,
        });
      }

      const shippingFee = 30000;
      const finalTotal = totalAmount + shippingFee;
      const orderCode = `DDUCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 2. Create Order
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

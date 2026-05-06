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
} from '../inventory/schemas/inventory.schema';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { CreateOrderDto } from './dto/create-order.dto';
import { generateUniqueHex } from 'src/common/utils/crypto.util';
import { formatDateCode } from 'src/common/utils/date.util';

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
      const { shippingAddress, paymentMethod, buyNowItem } = createOrderDto;

      const snapshotItems: any[] = [];
      let totalAmount = 0;

      // 1. Xác định nguồn hàng hóa: buyNowItem hoặc giỏ hàng
      const itemsToProcess = buyNowItem
        ? [buyNowItem]
        : (await this.cartService.getCart(userId)).items;

      if (!buyNowItem && itemsToProcess.length === 0) {
        throw new NotFoundException('Giỏ hàng không tồn tại hoặc đã trống');
      }

      // 2. Kiểm tra tính hợp lệ của sản phẩm và dựng snapshot
      for (const currentItem of itemsToProcess) {
        const product = await this.productModel
          .findById(currentItem.productId)
          .session(session);
        const variant = await this.variantModel
          .findById(currentItem.variantId)
          .session(session);

        if (
          !product ||
          !variant ||
          variant.productId.toString() !== product._id.toString()
        ) {
          throw new NotFoundException(
            `Sản phẩm ${currentItem.productId} không hợp lệ`,
          );
        }

        // Kiểm tra tồn kho SPECIFIC to the shop linked to this item
        const inventory = await this.inventoryModel
          .findOne({
            variantId: variant._id,
            shopId: currentItem.shopId,
          })
          .session(session);

        if (
          !inventory ||
          inventory.quantity - inventory.reservedQuantity < currentItem.quantity
        ) {
          throw new BusinessException(
            `Sản phẩm ${product.name} - ${variant.size}/${variant.color} tại chi nhánh đã hết hàng`,
            'BUSINESS_ERROR',
          );
        }

        // Đặt hàng trong kho
        inventory.reservedQuantity += currentItem.quantity;
        await inventory.save({ session });

        // Dựng snapshot sản phẩm khi mua
        const itemPrice = variant.price || product.basePrice;
        totalAmount += itemPrice * currentItem.quantity;

        snapshotItems.push({
          productId: product._id,
          variantId: variant._id,
          shopId: currentItem.shopId,
          name: product.name,
          image:
            product.images.find((img) => img.isMain)?.url ||
            product.images[0]?.url,
          size: variant.size,
          color: variant.color,
          price: itemPrice,
          quantity: currentItem.quantity,
        });
      }

      const shippingFee = 30000;
      const finalTotal = totalAmount + shippingFee;
      const orderCode = `DDW-${formatDateCode()}-${generateUniqueHex()}`;

      // 3. Tạo đơn hàng
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

      // 4. Xóa giỏ hàng sau khi tạo đơn nếu không phải mua ngay
      if (!buyNowItem) {
        await this.cartService.clearCart(userId);
      }

      await session.commitTransaction();
      return newOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findMyOrders(userId: string, query: any = {}) {
    const {
      status,
      orderCode,
      paymentStatus,
      paymentMethod,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = query;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (orderCode) {
      filter.orderCode = { $regex: orderCode, $options: 'i' };
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      data,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      totalItems: total,
    };
  }

  async findOneAdmin(id: string, shopId?: string) {
    const filter: any = { _id: id };
    if (shopId) {
      filter['items.shopId'] = new Types.ObjectId(shopId);
    }
    const order = await this.orderModel
      .findOne(filter)
      .populate('items.shopId', 'name');
    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');
    return order;
  }

  async findOneUser(id: string, userId: string) {
    const order = await this.orderModel
      .findOne({ _id: id, userId })
      .populate('items.shopId', 'name');
    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');
    return order;
  }

  async findByCode(orderCode: string, shopId?: string) {
    const filter: any = { orderCode };
    if (shopId) {
      filter['items.shopId'] = new Types.ObjectId(shopId);
    }
    const order = await this.orderModel
      .findOne(filter)
      .populate('items.shopId', 'name');
    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');
    return order;
  }

  async findAllAdmin(query: any) {
    const {
      shopId,
      status,
      orderCode,
      paymentStatus,
      paymentMethod,
      phone,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = query;
    const filter: any = {};

    if (shopId) {
      filter['items.shopId'] = new Types.ObjectId(shopId);
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (orderCode) {
      filter.orderCode = { $regex: orderCode, $options: 'i' };
    }

    if (phone) {
      filter['shippingAddress.phone'] = { $regex: phone, $options: 'i' };
    }

    if (fromDate || toDate) {
      if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        throw new BadRequestException(
          'Ngày bắt đầu không được lớn hơn ngày kết thúc',
        );
      }

      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('items.shopId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      data,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      totalItems: total,
    };
  }

  async updateStatus(id: string, status: string, shopId: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // Kiểm tra quyền sở hữu: Nếu shopId được cung cấp, kiểm tra xem đơn hàng này có thuộc về shop không
    if (shopId) {
      const hasItemFromShop = order.items.some(
        (item) => item.shopId.toString() === shopId.toString(),
      );
      if (!hasItemFromShop) {
        throw new BadRequestException(
          'Bạn không có quyền cập nhật đơn hàng này',
        );
      }
    }

    // Xử lý khi đơn hàng được hủy
    if (
      status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      return this.processCancellation(order);
    } else if (
      status === OrderStatus.COMPLETED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      // Khi đơn hàng được hoàn thành, trừ số lượng đã đặt và số lượng đã reserved
      const session = await this.connection.startSession();
      session.startTransaction();
      try {
        for (const item of order.items) {
          await this.inventoryModel.updateOne(
            { variantId: item.variantId, shopId: item.shopId },
            {
              $inc: {
                quantity: -item.quantity,
                reservedQuantity: -item.quantity,
              },
            },
            { session },
          );
        }
        order.status = status as OrderStatus;
        order.paymentStatus = PaymentStatus.PAID;
        await order.save({ session });
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      order.status = status as OrderStatus;
      await order.save();
    }

    return order;
  }

  async cancelMyOrder(id: string, userId: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // 1. Kiểm tra quyền sở hữu
    if (order.userId?.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền hủy đơn hàng này');
    }

    // 2. Kiểm tra trạng thái đơn hàng
    const allowedStatus = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!allowedStatus.includes(order.status)) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng khi đang chờ xử lý hoặc đã xác nhận',
      );
    }

    // 3. Xử lý hủy đơn hàng (giải phóng stock reservation)
    return this.processCancellation(order);
  }

  private async processCancellation(order: OrderDocument) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      for (const item of order.items) {
        await this.inventoryModel.updateOne(
          { variantId: item.variantId, shopId: item.shopId },
          { $inc: { reservedQuantity: -item.quantity } },
          { session },
        );
      }
      order.status = OrderStatus.CANCELLED;
      await order.save({ session });
      await session.commitTransaction();
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

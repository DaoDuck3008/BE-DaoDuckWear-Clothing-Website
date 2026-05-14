import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

const TZ = 'Asia/Ho_Chi_Minh';

interface AnalyticsParams {
  shopId: string | null;
  fromDate?: string;
  toDate?: string;
}

interface SummaryParams extends AnalyticsParams {
  role: string;
}

interface ResolvedRange {
  from: Date;
  to: Date;
  shopObjectId: Types.ObjectId | null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  private resolveRange(params: AnalyticsParams): ResolvedRange {
    const { fromDate, toDate, shopId } = params;

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException(
        'Ngày bắt đầu không được lớn hơn ngày kết thúc',
      );
    }

    const to = toDate ? new Date(toDate) : new Date();
    to.setHours(23, 59, 59, 999);

    const from = fromDate
      ? new Date(fromDate)
      : (() => {
          const d = new Date(to);
          d.setDate(d.getDate() - 6);
          d.setHours(0, 0, 0, 0);
          return d;
        })();
    if (fromDate) {
      from.setHours(0, 0, 0, 0);
    }

    return {
      from,
      to,
      shopObjectId: shopId ? new Types.ObjectId(shopId) : null,
    };
  }

  // Doanh thu được ghi nhận tại thời điểm `paidAt` (lúc khách trả tiền),
  // không phải `createdAt`. Đơn legacy cần chạy `npm run migrate:paidAt` để
  // backfill paidAt = updatedAt cho các đơn có paymentStatus = PAID.
  private baseMatch(
    range: ResolvedRange,
    opts?: { dateField?: 'createdAt' | 'paidAt' },
  ): PipelineStage.Match {
    const dateField = opts?.dateField ?? 'createdAt';
    const match: Record<string, any> = {
      deletedAt: null,
    };
    if (dateField === 'paidAt') {
      match.paymentStatus = PaymentStatus.PAID;
      match.paidAt = { $gte: range.from, $lte: range.to };
    } else {
      match.createdAt = { $gte: range.from, $lte: range.to };
    }
    if (range.shopObjectId) {
      match['items.shopId'] = range.shopObjectId;
    }
    return { $match: match };
  }

  // Pipeline: mỗi đơn hàng chỉ tính cho shop của đơn đó (theo paidAt)
  private perOrderShopRevenueStages(range: ResolvedRange): PipelineStage[] {
    const stages: PipelineStage[] = [
      this.baseMatch(range, { dateField: 'paidAt' }),
      { $unwind: '$items' },
    ];
    if (range.shopObjectId) {
      stages.push({ $match: { 'items.shopId': range.shopObjectId } });
    }
    stages.push({
      $group: {
        _id: '$_id',
        paidAt: { $first: '$paidAt' },
        shopRevenue: {
          $sum: { $multiply: ['$items.price', '$items.quantity'] },
        },
      },
    });
    return stages;
  }

  async getSummary(params: SummaryParams) {
    const range = this.resolveRange(params);

    const [aggResult] = await this.orderModel.aggregate([
      ...this.perOrderShopRevenueStages(range),
      {
        $group: {
          _id: null,
          revenue: { $sum: '$shopRevenue' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const revenue = aggResult?.revenue ?? 0;
    const orderCount = aggResult?.orderCount ?? 0;
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

    const base = { revenue, orderCount, avgOrderValue };

    // Nếu là ADMIN thì tính thêm số lượng khách hàng và tổng sản phẩm
    if (params.role === 'ADMIN') {
      const [customerCount, totalProducts] = await Promise.all([
        this.userModel.countDocuments({
          createdAt: { $lte: range.to },
          deletedAt: null,
        }),
        this.productModel.countDocuments({ deletedAt: null }),
      ]);
      return { ...base, customerCount, totalProducts };
    }

    // Nếu là SHOP thì tính thêm số lượng sản phẩm đã bán trong thời gian range
    const productCount = range.shopObjectId
      ? (
          await this.inventoryModel.distinct('productId', {
            shopId: range.shopObjectId,
          })
        ).length
      : 0;
    return { ...base, productCount };
  }

  // Lấy doanh thu theo ngày
  async getRevenueSeries(params: AnalyticsParams) {
    const range = this.resolveRange(params);

    const rows: { _id: string; revenue: number; orders: number }[] =
      await this.orderModel.aggregate([
        ...this.perOrderShopRevenueStages(range),
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$paidAt',
                timezone: TZ,
              },
            },
            revenue: { $sum: '$shopRevenue' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

    const map = new Map<string, { revenue: number; orders: number }>(
      rows.map((r) => [r._id, { revenue: r.revenue, orders: r.orders }]),
    );

    // Backfill every day in range so the chart line is continuous.
    const series: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(range.from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.to);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const key = this.formatDateInTZ(cursor);
      const found = map.get(key);
      series.push({
        date: key,
        revenue: found?.revenue ?? 0,
        orders: found?.orders ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return series;
  }

  // Format ngày tháng theo múi giờ Việt Nam
  private formatDateInTZ(d: Date): string {
    // Build YYYY-MM-DD in Asia/Ho_Chi_Minh to align with $dateToString.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${day}`;
  }

  // Số lượng đơn hàng theo trạng thái — không filter theo date range của
  // dashboard. Đây là phân bố cấu trúc toàn bộ đơn của shop (giống recent
  // orders), không phải dữ liệu time-bound.
  async getOrdersByStatus(params: AnalyticsParams) {
    const { shopId } = params;
    const match: Record<string, any> = { deletedAt: null };
    if (shopId) {
      match['items.shopId'] = new Types.ObjectId(shopId);
    }

    const rows: { _id: OrderStatus; count: number }[] =
      await this.orderModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

    const lookup = new Map<string, number>(rows.map((r) => [r._id, r.count]));
    const order: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.SHIPPING,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ];
    return order.map((status) => ({
      status,
      count: lookup.get(status) ?? 0,
    }));
  }

  // Lấy top sản phẩm theo doanh thu
  async getTopProducts(params: AnalyticsParams) {
    const range = this.resolveRange(params);

    const stages: PipelineStage[] = [
      this.baseMatch(range, { dateField: 'paidAt' }),
      { $unwind: '$items' },
    ];
    if (range.shopObjectId) {
      stages.push({ $match: { 'items.shopId': range.shopObjectId } });
    }
    stages.push(
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          image: { $first: '$items.image' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: 1,
          image: 1,
          unitsSold: 1,
          revenue: 1,
        },
      },
    );

    return this.orderModel.aggregate(stages);
  }

  // Lấy đơn hàng gần nhất (tối đa 8 đơn). Không phụ thuộc date range của
  // dashboard — đây là "luồng hoạt động mới nhất" của shop, không phải
  // tập đơn nằm trong khoảng đang xem.
  async getRecentOrders(params: AnalyticsParams) {
    const { shopId } = params;
    const filter: Record<string, any> = { deletedAt: null };
    if (shopId) {
      filter['items.shopId'] = new Types.ObjectId(shopId);
    }

    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderCode shippingAddress.fullName finalTotal status createdAt')
      .lean();

    return orders.map((o: any) => ({
      _id: o._id,
      orderCode: o.orderCode,
      customerName: o.shippingAddress?.fullName ?? '',
      total: o.finalTotal,
      status: o.status,
      createdAt: o.createdAt,
    }));
  }

  // Tỷ lệ sản phẩm theo danh mục.
  // - ADMIN: count toàn bộ products active (deletedAt: null).
  // - MANAGER/STAFF: chỉ count products có trong Inventory của shop đó.
  // Sau khi gom theo categoryId, lấy top 7 và gom phần còn lại thành "Khác".
  async getProductsByCategory(params: AnalyticsParams) {
    const { shopId } = params;
    const TOP_N = 7;

    let rows: { _id: Types.ObjectId | null; count: number }[];

    if (shopId) {
      const shopObjectId = new Types.ObjectId(shopId);
      rows = await this.inventoryModel.aggregate([
        { $match: { shopId: shopObjectId } },
        { $group: { _id: '$productId' } },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $match: { 'product.deletedAt': null } },
        { $group: { _id: '$product.categoryId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
    } else {
      rows = await this.productModel.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
    }

    if (rows.length === 0) return [];

    // Lookup tên category cho các bucket có categoryId
    const categoryIds = rows
      .map((r) => r._id)
      .filter((id): id is Types.ObjectId => id !== null);
    const categories = await this.categoryModel
      .find({ _id: { $in: categoryIds } })
      .select('name')
      .lean();
    const nameById = new Map(
      categories.map((c: any) => [c._id.toString(), c.name as string]),
    );

    const named = rows.map((r) => ({
      categoryId: r._id ? r._id.toString() : null,
      name: r._id
        ? (nameById.get(r._id.toString()) ?? 'Không xác định')
        : 'Chưa phân loại',
      count: r.count,
    }));

    if (named.length <= TOP_N) return named;

    const top = named.slice(0, TOP_N);
    const restCount = named
      .slice(TOP_N)
      .reduce((sum, item) => sum + item.count, 0);
    return [...top, { categoryId: null, name: 'Khác', count: restCount }];
  }
}

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Inventory } from './schemas/inventory.schema';
import {
  IMPORT_STATUS,
  InventoryImport,
} from './schemas/inventory-import.schema';
import { Product } from '../products/schemas/product.schema';
import { ProductVariant } from '../products/schemas/product-variant.schema';
import { ProductsService } from '../products/products.service';
import { CreateImportDto } from './dto/create-import.dto';
import { ListImportsDto } from './dto/list-imports.dto';
import { RevokeImportDto } from './dto/revoke-import.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface RequestUser {
  id: string;
  role: string;
  shopId?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<any>,
    @InjectModel(InventoryImport.name)
    private readonly importModel: Model<any>,
    @InjectModel(Product.name)
    private readonly productModel: Model<any>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<any>,
    private readonly productsService: ProductsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAllInventoryAdmin(query: {
    shopId?: string;
    search?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const {
      shopId,
      search,
      categoryId,
      page = 1,
      limit = 10,
      sort = 'createdAt_desc',
    } = query;
    const offset = (page - 1) * limit;

    const [field, order] = sort.split('_');
    const sortOptions: any = {};
    sortOptions[field || 'createdAt'] = order === 'asc' ? 1 : -1;

    let productIds: Types.ObjectId[] | null = null;

    if (search) {
      const variantsWithSku = await this.variantModel
        .find({
          sku: { $regex: search, $options: 'i' },
          deletedAt: null,
        })
        .select('productId');

      if (variantsWithSku.length > 0) {
        productIds = variantsWithSku.map((v) => v.productId);
      }
    }

    const productFilter: any = { deletedAt: null };
    if (categoryId) {
      productFilter.categoryId = this.toObjectId(categoryId);
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      if (productIds) {
        productFilter.$or = [
          { name: searchRegex },
          { slug: searchRegex },
          { _id: { $in: productIds } },
        ];
      } else {
        productFilter.$or = [{ name: searchRegex }, { slug: searchRegex }];
      }
    }

    const [products, total] = await Promise.all([
      this.productModel
        .find(productFilter)
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .populate('categoryId'),
      this.productModel.countDocuments(productFilter),
    ]);

    const finalProductIds = products.map((p) => p._id);

    const inventoryFilter: any = { productId: { $in: finalProductIds } };
    if (shopId) {
      inventoryFilter.shopId = this.toObjectId(shopId);
    }

    const [variants, inventories] = await Promise.all([
      this.variantModel.find({
        productId: { $in: finalProductIds },
        deletedAt: null,
      }),
      this.inventoryModel.find(inventoryFilter),
    ]);

    const data = products.map((product) => {
      const productJson = product.toJSON();
      const productVariants = variants.filter(
        (v) => v.productId.toString() === product.id,
      );

      return {
        ...productJson,
        variants: productVariants.map((variant) => {
          const variantInventories = inventories.filter(
            (inv) => inv.variantId.toString() === variant.id,
          );

          return {
            ...variant.toJSON(),
            quantity: variantInventories.reduce(
              (sum, inv) => sum + (inv.quantity || 0),
              0,
            ),
            reservedQuantity: variantInventories.reduce(
              (sum, inv) => sum + (inv.reservedQuantity || 0),
              0,
            ),
          };
        }),
      };
    });

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneProductInventory(slug: string, shopId?: string) {
    const product = await this.productModel
      .findOne({ slug, deletedAt: null })
      .populate('categoryId');
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const inventoryFilter: any = { productId: product._id };
    if (shopId) {
      inventoryFilter.shopId = this.toObjectId(shopId);
    }

    const [variants, inventories] = await Promise.all([
      this.variantModel.find({ productId: product._id, deletedAt: null }),
      this.inventoryModel.find(inventoryFilter),
    ]);

    return {
      ...product.toJSON(),
      variants: variants.map((variant) => {
        const variantInventories = inventories.filter(
          (inv) => inv.variantId.toString() === variant.id,
        );
        return {
          ...variant.toJSON(),
          quantity: variantInventories.reduce(
            (sum, inv) => sum + (inv.quantity || 0),
            0,
          ),
          reservedQuantity: variantInventories.reduce(
            (sum, inv) => sum + (inv.reservedQuantity || 0),
            0,
          ),
        };
      }),
    };
  }

  async createImport(user: RequestUser, dto: CreateImportDto) {
    const shopId = this.resolveShopId(user, dto.shopId);

    const product = await this.productModel.findOne({
      _id: this.toObjectId(dto.productId),
      deletedAt: null,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const variantIds = dto.items.map((i) => this.toObjectId(i.variantId));
    const uniqueVariantIds = new Set(dto.items.map((i) => i.variantId));
    if (uniqueVariantIds.size !== dto.items.length) {
      throw new BadRequestException('Mỗi biến thể chỉ được xuất hiện một lần');
    }

    const variants = await this.variantModel.find({
      _id: { $in: variantIds },
      productId: product._id,
      deletedAt: null,
    });

    if (variants.length !== dto.items.length) {
      throw new BadRequestException(
        'Có biến thể không thuộc sản phẩm hoặc không tồn tại',
      );
    }
    const skuByVariant = new Map<string, string>(
      variants.map((v) => [v.id, v.sku]),
    );

    const bulkOps = dto.items.map((item) => ({
      updateOne: {
        filter: {
          shopId: this.toObjectId(shopId),
          variantId: this.toObjectId(item.variantId),
        },
        update: {
          $inc: { quantity: item.quantity },
          $setOnInsert: {
            shopId: this.toObjectId(shopId),
            productId: product._id,
            variantId: this.toObjectId(item.variantId),
          },
        },
        upsert: true,
      },
    }));

    const totalQuantity = dto.items.reduce((sum, i) => sum + i.quantity, 0);

    const importPayload = {
      shopId: this.toObjectId(shopId),
      productId: product._id,
      createdBy: this.toObjectId(user.id),
      items: dto.items.map((item) => ({
        variantId: this.toObjectId(item.variantId),
        quantity: item.quantity,
        sku: skuByVariant.get(item.variantId) || null,
      })),
      totalQuantity,
      status: IMPORT_STATUS.ACTIVE,
      note: dto.note || null,
    };

    const session = await this.connection.startSession();
    let importDoc: any;
    try {
      await session.withTransaction(async () => {
        await this.inventoryModel.bulkWrite(bulkOps, { session });
        const created = await this.importModel.create([importPayload], {
          session,
        });
        importDoc = created[0];
      });
    } finally {
      await session.endSession();
    }

    await this.productsService.invalidateProductCacheByProductId(
      product._id.toString(),
    );

    void this.auditLogsService.log({
      userId: user.id,
      action: 'CREATE_INVENTORY_IMPORT',
      entityName: 'InventoryImport',
      entityId: importDoc._id,
      newData: {
        productId: dto.productId,
        shopId: shopId,
        totalQuantity,
        itemCount: dto.items.length,
        note: dto.note ?? null,
      },
    });

    return importDoc.toJSON();
  }

  async listImports(user: RequestUser, query: ListImportsDto) {
    const {
      productId,
      status,
      from,
      to,
      page = 1,
      limit = 10,
      sort = 'createdAt_desc',
    } = query;

    const filter: any = {};

    if (user.role === 'ADMIN') {
      if (query.shopId) filter.shopId = this.toObjectId(query.shopId);
    } else {
      if (!user.shopId) {
        throw new BadRequestException('Tài khoản chưa được gán chi nhánh');
      }
      filter.shopId = this.toObjectId(user.shopId);
    }

    if (productId) filter.productId = this.toObjectId(productId);
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [field, order] = sort.split('_');
    const sortOptions: any = {};
    sortOptions[field || 'createdAt'] = order === 'asc' ? 1 : -1;

    const offset = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.importModel
        .find(filter)
        .sort(sortOptions)
        .skip(offset)
        .limit(Number(limit))
        .populate({ path: 'productId', select: 'name slug images' })
        .populate({ path: 'shopId', select: 'name slug cityName' })
        .populate({ path: 'createdBy', select: 'username fullName' })
        .populate({ path: 'revokedBy', select: 'username fullName' }),
      this.importModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async getImportDetail(user: RequestUser, id: string) {
    const doc = await this.importModel
      .findById(this.toObjectId(id))
      .populate({ path: 'productId', select: 'name slug images' })
      .populate({ path: 'shopId', select: 'name slug cityName' })
      .populate({ path: 'createdBy', select: 'username fullName' })
      .populate({ path: 'revokedBy', select: 'username fullName' })
      .populate({
        path: 'items.variantId',
        select: 'size color image sku price',
      });
    if (!doc) throw new NotFoundException('Phiếu nhập không tồn tại');

    const shopId = (
      doc.shopId && doc.shopId._id ? doc.shopId._id : doc.shopId
    ).toString();

    if (user.role !== 'ADMIN') {
      if (!user.shopId || shopId !== user.shopId.toString()) {
        throw new ForbiddenException('Không có quyền xem phiếu nhập này');
      }
    }

    const variantIds = doc.items.map((i: any) =>
      i.variantId && i.variantId._id ? i.variantId._id : i.variantId,
    );
    const inventories = await this.inventoryModel.find({
      shopId: this.toObjectId(shopId),
      variantId: { $in: variantIds },
    });
    const invByVariant = new Map<string, any>(
      inventories.map((inv) => [inv.variantId.toString(), inv]),
    );

    const json: any = doc.toJSON();
    const revokeBlockers: {
      variantId: string;
      sku: string | null;
      needed: number;
      currentQuantity: number;
      reservedQuantity: number;
      shortage: number;
    }[] = [];

    json.items = json.items.map((item: any) => {
      const vid = (
        item.variantId &&
        (item.variantId.id || item.variantId._id || item.variantId)
      ).toString();
      const inv = invByVariant.get(vid);
      const currentQuantity = inv?.quantity || 0;
      const reservedQuantity = inv?.reservedQuantity || 0;
      const afterRevoke = currentQuantity - item.quantity;
      const minRequired = Math.max(0, reservedQuantity);
      const canRevokeItem = afterRevoke >= minRequired;
      if (!canRevokeItem && doc.status === IMPORT_STATUS.ACTIVE) {
        revokeBlockers.push({
          variantId: vid,
          sku: item.sku || null,
          needed: item.quantity,
          currentQuantity,
          reservedQuantity,
          shortage: minRequired - afterRevoke,
        });
      }
      return { ...item, currentQuantity, reservedQuantity };
    });

    json.canRevoke =
      doc.status === IMPORT_STATUS.ACTIVE && revokeBlockers.length === 0;
    json.revokeBlockers = revokeBlockers;

    return json;
  }

  async revokeImport(user: RequestUser, id: string, dto: RevokeImportDto) {
    if (user.role === 'STAFF') {
      throw new ForbiddenException('STAFF không có quyền thu hồi phiếu nhập');
    }

    const doc = await this.importModel.findById(this.toObjectId(id));
    if (!doc) throw new NotFoundException('Phiếu nhập không tồn tại');

    if (user.role !== 'ADMIN') {
      if (!user.shopId || doc.shopId.toString() !== user.shopId.toString()) {
        throw new ForbiddenException('Không có quyền thu hồi phiếu nhập này');
      }
    }

    if (doc.status !== IMPORT_STATUS.ACTIVE) {
      throw new BusinessException(
        'Phiếu nhập đã được thu hồi trước đó',
        'IMPORT_ALREADY_REVOKED',
      );
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const variantIds = doc.items.map((i: any) => i.variantId);
        const inventories = await this.inventoryModel
          .find({
            shopId: doc.shopId,
            variantId: { $in: variantIds },
          })
          .session(session);

        const invMap = new Map<string, any>(
          inventories.map((inv) => [inv.variantId.toString(), inv]),
        );

        const insufficient: {
          variantId: string;
          sku: string | null;
          needed: number;
          available: number;
        }[] = [];
        for (const item of doc.items) {
          const inv = invMap.get(item.variantId.toString());
          const currentQty = inv?.quantity || 0;
          const reserved = inv?.reservedQuantity || 0;
          const afterRevoke = currentQty - item.quantity;
          if (afterRevoke < 0 || afterRevoke < reserved) {
            insufficient.push({
              variantId: item.variantId.toString(),
              sku: item.sku || null,
              needed: item.quantity,
              available: Math.max(0, currentQty - reserved),
            });
          }
        }

        if (insufficient.length > 0) {
          throw new BusinessException(
            `Không thể thu hồi: tồn kho không đủ cho ${insufficient.length} biến thể (có thể đã được bán hoặc đang giữ chỗ trong đơn hàng).`,
            'IMPORT_REVOKE_INSUFFICIENT_STOCK',
          );
        }

        const bulkOps = doc.items.map((item: any) => ({
          updateOne: {
            filter: { shopId: doc.shopId, variantId: item.variantId },
            update: { $inc: { quantity: -item.quantity } },
          },
        }));

        await this.inventoryModel.bulkWrite(bulkOps, { session });

        doc.status = IMPORT_STATUS.REVOKED;
        doc.revokedBy = this.toObjectId(user.id);
        doc.revokedAt = new Date();
        if (dto.note) {
          doc.note = doc.note ? `${doc.note}\n[Thu hồi] ${dto.note}` : dto.note;
        }
        await doc.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await this.productsService.invalidateProductCacheByProductId(
      doc.productId.toString(),
    );

    void this.auditLogsService.log({
      userId: user.id,
      action: 'REVOKE_INVENTORY_IMPORT',
      entityName: 'InventoryImport',
      entityId: doc._id,
      oldData: { status: 'ACTIVE' },
      newData: { status: 'REVOKED', note: dto.note ?? null },
    });

    return doc.toJSON();
  }

  private resolveShopId(user: RequestUser, requestedShopId?: string): string {
    if (user.role === 'ADMIN') {
      const shopId = requestedShopId || user.shopId;
      if (!shopId) {
        throw new BadRequestException('Vui lòng chọn chi nhánh');
      }
      return shopId;
    }
    if (!user.shopId) {
      throw new BadRequestException('Tài khoản chưa được gán chi nhánh');
    }
    return user.shopId;
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inventory } from './schemas/inventory.schema';
import { Product } from '../products/schemas/product.schema';
import { ProductVariant } from '../products/schemas/product-variant.schema';
import { ProductsService } from '../products/products.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<any>,
    @InjectModel(Product.name)
    private readonly productModel: Model<any>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<any>,
    private readonly productsService: ProductsService,
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

    // Nếu search theo SKU, ta tìm các Variant trước
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

    // Lấy variants và tồn kho cùng lúc
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

  async updateInventory(data: {
    shopId: string;
    productId: string;
    variantId: string;
    quantity: number;
  }) {
    const { shopId, productId, variantId, quantity } = data;

    const existingInventory = await this.inventoryModel.findOne({
      shopId: this.toObjectId(shopId),
      variantId: this.toObjectId(variantId),
    });

    if (!existingInventory) {
      if (quantity === 0) {
        return { message: 'Bỏ qua vì số lượng bằng 0' };
      }

      await this.inventoryModel.create({
        shopId: this.toObjectId(shopId),
        productId: this.toObjectId(productId),
        variantId: this.toObjectId(variantId),
        quantity,
      });
    } else {
      existingInventory.quantity = quantity;
      await existingInventory.save();
    }

    // Tồn kho đã đổi → invalidate cache chi tiết sản phẩm tương ứng
    await this.productsService.invalidateProductCacheByProductId(productId);

    return { success: true };
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

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

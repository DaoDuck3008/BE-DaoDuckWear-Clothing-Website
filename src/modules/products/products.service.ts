import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductImage } from './schemas/product.schema';
import { ProductVariant } from './schemas/product-variant.schema';
import { SlugGenerator } from '../../common/utils/slug.util';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Category } from '../categories/schemas/category.schema';
import { RedisService } from '../redis/redis.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const PRODUCT_SLUG_PREFIX = 'product:slug:';
const PRODUCT_SIMILAR_PREFIX = 'product:similar:';
const PRODUCT_SLUG_TTL = 300; // 5 phút — đủ ngắn để stock không quá lệch
const PRODUCT_SIMILAR_TTL = 300; // 5 phút

@Injectable()
export class ProductsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
    @InjectModel(ProductVariant.name) private readonly variantModel: Model<any>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<any>,
    @InjectModel(Category.name) private readonly categoryModel: Model<any>,
    private readonly cloudinary: CloudinaryService,
    private readonly redis: RedisService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // Public: cho InventoryService gọi khi tồn kho thay đổi
  async invalidateProductCacheByProductId(productId: string | Types.ObjectId) {
    const product = await this.productModel
      .findById(productId)
      .select('slug')
      .lean();
    if (!product?.slug) return;
    await this.invalidateProductCacheBySlug(product.slug);
  }

  private async invalidateProductCacheBySlug(slug: string) {
    await Promise.all([
      this.redis.del(`${PRODUCT_SLUG_PREFIX}${slug}`),
      this.redis.delByPrefix(`${PRODUCT_SIMILAR_PREFIX}${slug}:`),
    ]);
  }

  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
    actingUserId?: string,
  ) {
    const { name, categoryId, basePrice, description, status, variants } =
      createProductDto;

    const slug = createProductDto.slug ?? SlugGenerator(name); // Generate SLUG từ tên sản phẩm

    const existingProduct = await this.productModel.exists({ slug }); // Check xem có slug đã tồn tại chưa
    if (existingProduct) {
      throw new BadRequestException('Sản phẩm đã tồn tại');
    }

    const duplicatedSku = await this.variantModel.exists({
      sku: { $in: variants.map((variant) => variant.sku) },
    });
    if (duplicatedSku) {
      throw new BadRequestException('SKU đã tồn tại trong hệ thống');
    }

    const uploadResults = await this.cloudinary.uploadProductImages(
      files,
      slug,
    ); // Upload ảnh lên Cloudinary

    const session = await this.connection.startSession();
    let result: any;
    try {
      result = await session.withTransaction(async () => {
        const product = await this.productModel.create(
          [
            {
              name,
              slug,
              categoryId: this.toObjectId(categoryId),
              basePrice: Number(basePrice),
              description,
              status: status || 'active',
              images: uploadResults,
            },
          ],
          { session },
        );

        const createdProduct = product[0];

        for (const variantDto of variants) {
          const variantPrice = variantDto.price
            ? Number(variantDto.price)
            : Number(basePrice); // Nếu không có giá variant => dùng giá basePrice
          const upperColor = variantDto.color.toUpperCase(); // Viết hoa màu

          // Tìm ảnh khớp màu cho variant (ưu tiên ảnh isMain)
          const variantImage =
            uploadResults.find(
              (img) => img.color === upperColor && img.isMain,
            ) || uploadResults.find((img) => img.color === upperColor);

          await this.variantModel.create(
            [
              {
                productId: createdProduct._id,
                size: variantDto.size,
                color: upperColor,
                image: variantImage?.url || null, // Ảnh của variant
                imagePublicId: variantImage?.publicId || null, // PublicId ảnh của variant
                colorHexId: variantDto.colorHexId
                  ? this.toObjectId(variantDto.colorHexId)
                  : null,
                price: variantPrice,
                sku: variantDto.sku,
              },
            ],
            { session },
          );
        }

        return createdProduct.toJSON();
      });
    } finally {
      await session.endSession();
    }
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'CREATE_PRODUCT',
      entityName: 'Product',
      entityId: result?._id,
      newData: {
        name: createProductDto.name,
        slug,
        basePrice: createProductDto.basePrice,
        status: createProductDto.status || 'active',
      },
    });
    return result;
  }

  async findAll(query: {
    categoryId?: string;
    colorHexId?: string | string[];
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    limit?: number;
    page?: number;
  }) {
    const {
      categoryId,
      colorHexId,
      size,
      minPrice,
      maxPrice,
      sort,
      limit = 12,
      page = 1,
    } = query;

    const offset = (page - 1) * limit;

    // 1. Xây dựng filter cho ProductVariant
    const variantFilter: any = { deletedAt: null };
    if (colorHexId) {
      if (Array.isArray(colorHexId)) {
        variantFilter.colorHexId = {
          $in: colorHexId.map((id) => this.toObjectId(id)),
        };
      } else {
        variantFilter.colorHexId = this.toObjectId(colorHexId);
      }
    }
    if (size) variantFilter.size = size;

    let productIds: Types.ObjectId[] | null = null;
    if (colorHexId || size) {
      const matchingVariants = await this.variantModel.find(
        variantFilter,
        'productId',
      );
      productIds = matchingVariants.map((v) => v.productId);
    }

    // 2. Xây dựng filter cho Product
    const productFilter: any = { deletedAt: null, status: 'active' };
    if (productIds) productFilter._id = { $in: productIds };
    if (categoryId) {
      const children = await this.categoryModel.find({
        parentId: this.toObjectId(categoryId),
      });
      if (children.length > 0) {
        const childrenIds = children.map((c) => this.toObjectId(c._id));
        productFilter.categoryId = {
          $in: [this.toObjectId(categoryId), ...childrenIds],
        };
      } else {
        productFilter.categoryId = this.toObjectId(categoryId);
      }
    }

    // Filter theo giá
    if (minPrice || maxPrice) {
      productFilter.basePrice = {};
      if (minPrice) productFilter.basePrice.$gte = Number(minPrice);
      if (maxPrice) productFilter.basePrice.$lte = Number(maxPrice);
    }

    // 3. Sắp xếp
    let sortOptions: any = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { basePrice: 1 };
    if (sort === 'price_desc') sortOptions = { basePrice: -1 };
    if (sort === 'newest') sortOptions = { createdAt: -1 };

    const [products, total] = await Promise.all([
      this.productModel
        .find(productFilter)
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .populate('categoryId'),
      this.productModel.countDocuments(productFilter),
    ]);

    return {
      data: products,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllAdmin(query: {
    shopId?: string;
    status?: string;
    search?: string;
    categoryId?: string;
    sort?: string;
  }) {
    const { shopId, status, search, categoryId, sort } = query;
    const filter: any = { deletedAt: null };

    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };
    // if (categoryId) filter.categoryId = this.toObjectId(categoryId);
    if (categoryId) {
      const children = await this.categoryModel.find({
        parentId: this.toObjectId(categoryId),
      });
      if (children.length > 0) {
        const childrenIds = children.map((c) => this.toObjectId(c._id));
        filter.categoryId = {
          $in: [this.toObjectId(categoryId), ...childrenIds],
        };
      } else {
        filter.categoryId = this.toObjectId(categoryId);
      }
    }

    if (shopId) {
      const productIds = await this.inventoryModel.distinct('productId', {
        shopId: this.toObjectId(shopId),
      });
      filter._id = { $in: productIds };
    }

    let sortOptions: any = { createdAt: -1 };
    if (sort === 'name_asc') sortOptions = { name: 1 };
    if (sort === 'name_desc') sortOptions = { name: -1 };
    if (sort === 'price_asc') sortOptions = { basePrice: 1 };
    if (sort === 'price_desc') sortOptions = { basePrice: -1 };
    if (sort === 'newest') sortOptions = { createdAt: -1 };
    if (sort === 'oldest') sortOptions = { createdAt: 1 };

    const products = await this.productModel
      .find(filter)
      .sort(sortOptions)
      .populate('categoryId');

    // Đếm số biến thể còn hoạt động cho mỗi sản phẩm
    const productIds = products.map((p) => p._id);
    const variantCounts = await this.variantModel.aggregate([
      { $match: { productId: { $in: productIds }, deletedAt: null } },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
    ]);
    const countMap = variantCounts.reduce(
      (acc, v) => {
        acc[v._id.toString()] = v.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return products.map((p) => ({
      ...(p.toJSON ? p.toJSON() : p),
      variantCount: countMap[p._id.toString()] || 0,
    }));
  }

  async findBySlug(slug: string) {
    return this.redis.cacheable(
      `${PRODUCT_SLUG_PREFIX}${slug}`,
      PRODUCT_SLUG_TTL,
      () => this.findBySlugFromDb(slug),
    );
  }

  private async findBySlugFromDb(slug: string) {
    const product = await this.productModel
      .findOne({ slug, deletedAt: null })
      .populate('categoryId');

    if (!product) {
      throw new BadRequestException('Sản phẩm không tồn tại');
    }

    const variants = await this.variantModel
      .find({ productId: product._id, deletedAt: null })
      .sort({ createdAt: 1 });

    const inventories = await this.inventoryModel
      .find({ productId: product._id })
      .populate('shopId');

    const productJson = product.toJSON() as Record<string, any>;
    const category = productJson.categoryId;
    delete productJson.categoryId;

    return {
      ...productJson,
      category,
      variants: variants.map((variant) => {
        // Time complexity O(n*m)
        const variantJson = variant.toJSON() as Record<string, any>;
        variantJson.inventories = inventories
          .filter((inventory) => inventory.variantId.toString() === variant.id)
          .map((inventory) => {
            const inventoryJson = inventory.toJSON() as Record<string, any>;
            const shop = inventory.shopId;

            if (shop) {
              inventoryJson.shop = shop;
              inventoryJson.shopId = shop.id;
            } else {
              inventoryJson.shop = null;
              inventoryJson.shopId = null;
            }

            return inventoryJson;
          });
        return variantJson;
      }),
    };
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    files: Express.Multer.File[], // File ảnh mới
    actingUserId?: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const {
      name,
      categoryId,
      basePrice,
      description,
      status,
      variants,
      deleteImageIds, // Mảng ID ảnh cũ cần xóa
    } = updateProductDto;

    const previousSlug = product.slug;

    // Cập nhật slug nếu tên thay đổi
    let slug = product.slug;
    if (name && name !== product.name) {
      slug = SlugGenerator(name);
    }

    // 1. Xóa tham chiếu ảnh cũ khỏi DB
    let currentImages = [...product.images];
    const idsToDelete: string[] = deleteImageIds ?? [];

    if (idsToDelete.length > 0) {
      currentImages = currentImages.filter(
        (img: any) =>
          !idsToDelete.includes(img.id?.toString() || img._id?.toString()),
      ); // kiểm tra và lọc ra các ảnh cũ cần xóa theo id
    }

    // 2. Upload ảnh mới (nếu có files)
    let newUploadResults: ProductImage[] = [];
    if (files && files.length > 0) {
      newUploadResults = await this.cloudinary.uploadProductImages(files, slug);
    }

    // Ghép ảnh cũ còn lại + ảnh mới
    const mergedImages = [...currentImages, ...newUploadResults];

    const session = await this.connection.startSession();
    let result: any;
    try {
      result = await session.withTransaction(async () => {
        // 3. Cập nhật thông tin Product
        await this.productModel.findByIdAndUpdate(
          id,
          {
            ...(name && { name }),
            ...(name && { slug }),
            ...(categoryId && { categoryId: this.toObjectId(categoryId) }),
            ...(basePrice && { basePrice: Number(basePrice) }),
            ...(description !== undefined && { description }),
            ...(status && { status }),
            images: mergedImages,
          },
          { session },
        );

        // 4. Cập nhật Variants (Đồng bộ: Thêm/Sửa/Xóa mềm)
        if (variants) {
          const variantsList = variants;

          // Lấy danh sách ID variant hiện tại trong DB (chưa xóa)
          const currentVariants = await this.variantModel
            .find({ productId: id, deletedAt: null })
            .session(session);

          const currentIds = currentVariants.map((v) => v._id.toString());
          const incomingIds = variantsList
            .filter((v: any) => v.id)
            .map((v: any) => v.id);

          // Bước A: Tìm các ID cần XÓA MỀM (Có trong DB nhưng không có trong list gửi lên)
          const idsToDelete = currentIds.filter(
            (cid) => !incomingIds.includes(cid),
          );
          if (idsToDelete.length > 0) {
            await this.variantModel.updateMany(
              { _id: { $in: idsToDelete } },
              { deletedAt: new Date() },
              { session },
            );
          }

          // Bước B: Lặp qua list gửi lên để CẬP NHẬT hoặc THÊM MỚI
          for (const v of variantsList) {
            const upperColor = v.color?.toUpperCase();
            // Tìm ảnh khớp màu mới nhất từ danh sách đã gộp (ưu tiên ảnh isMain)
            const variantImage =
              mergedImages.find(
                (img: any) => img.color === upperColor && img.isMain,
              ) || mergedImages.find((img: any) => img.color === upperColor);

            if (v.id) {
              // Trường hợp 1: CẬP NHẬT
              await this.variantModel.findByIdAndUpdate(
                v.id,
                {
                  ...(v.price && { price: Number(v.price) }),
                  ...(v.sku && { sku: v.sku }),
                  ...(v.size && { size: v.size }),
                  ...(v.color && { color: upperColor }),
                  colorHexId: v.colorHexId
                    ? this.toObjectId(v.colorHexId)
                    : null,
                  image: variantImage?.url || null,
                  imagePublicId: variantImage?.publicId || null,
                },
                { session },
              );
            } else {
              // Trường hợp 2: THÊM MỚI (Không có id)
              await this.variantModel.create(
                [
                  {
                    productId: id,
                    sku: v.sku || `SKU-${Date.now()}-${Math.random()}`,
                    size: v.size,
                    color: upperColor,
                    colorHexId: v.colorHexId
                      ? this.toObjectId(v.colorHexId)
                      : null,
                    price: Number(v.price || basePrice),
                    image: variantImage?.url || null,
                    imagePublicId: variantImage?.publicId || null,
                    status: 'active',
                  },
                ],
                { session },
              );
            }
          }
        }

        return { success: true, slug };
      });

      // Invalidate cache cả slug cũ lẫn slug mới (trường hợp đổi tên)
      await this.invalidateProductCacheBySlug(previousSlug);
      if (slug !== previousSlug) {
        await this.invalidateProductCacheBySlug(slug);
      }
    } finally {
      await session.endSession();
    }
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'UPDATE_PRODUCT',
      entityName: 'Product',
      entityId: id,
      newData: {
        name: updateProductDto.name,
        slug,
        basePrice: updateProductDto.basePrice,
        status: updateProductDto.status,
      },
    });
    return result;
  }

  async remove(id: string, actingUserId?: string) {
    const product = await this.productModel.findById(id);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    // SUPER_ADMIN thực hiện xóa mềm toàn hệ thống
    await this.productModel.findByIdAndUpdate(id, { deletedAt: new Date() }); // SOFT DELETE cho product
    await this.variantModel.updateMany(
      { productId: id },
      { deletedAt: new Date() }, // SOFT DELETE cho variant
    );

    await this.invalidateProductCacheBySlug(product.slug);
    void this.auditLogsService.log({
      userId: actingUserId,
      action: 'DELETE_PRODUCT',
      entityName: 'Product',
      entityId: id,
      oldData: { name: product.name, slug: product.slug },
    });
    return { message: 'Đã xóa sản phẩm thành công' };
  }

  async getSimilarProducts(slug: string, limit = 5) {
    return this.redis.cacheable(
      `${PRODUCT_SIMILAR_PREFIX}${slug}:${limit}`,
      PRODUCT_SIMILAR_TTL,
      () => this.getSimilarProductsFromDb(slug, limit),
    );
  }

  private async getSimilarProductsFromDb(slug: string, limit: number) {
    const current = await this.productModel
      .findOne({ slug, deletedAt: null })
      .select('_id categoryId basePrice')
      .lean();
    if (!current) throw new NotFoundException('Không tìm thấy sản phẩm');

    const results: any[] = [];
    const excludeIds: any[] = [current._id];
    const baseMatch: any = { deletedAt: null, status: 'active' };

    const catLookup = [
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryArr',
        },
      },
      { $addFields: { categoryId: { $arrayElemAt: ['$categoryArr', 0] } } },
      { $project: { categoryArr: 0 } },
    ];

    const buildPipeline = (matchExtra: object, n: number) => [
      { $match: { ...baseMatch, _id: { $nin: excludeIds }, ...matchExtra } },
      { $sample: { size: n } },
      ...catLookup,
    ];

    const format = (p: any) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      images: p.images ?? [],
      category: p.categoryId ? { name: p.categoryId.name } : undefined,
    });

    // Stage 1: cùng category con
    if (current.categoryId && results.length < limit) {
      const r = await this.productModel.aggregate(
        buildPipeline(
          { categoryId: current.categoryId },
          limit - results.length,
        ),
      );
      results.push(...r);
      excludeIds.push(...r.map((p) => p._id));
    }

    // Stage 2: cùng category cha (anh/em)
    if (results.length < limit && current.categoryId) {
      const cat = await this.categoryModel
        .findById(current.categoryId)
        .select('parentId')
        .lean();
      if (cat?.parentId) {
        const siblings = await this.categoryModel
          .find({ parentId: cat.parentId, deletedAt: null })
          .select('_id')
          .lean();
        const sibIds = siblings.map((s) => s._id);
        const r = await this.productModel.aggregate(
          buildPipeline(
            { categoryId: { $in: sibIds } },
            limit - results.length,
          ),
        );
        results.push(...r);
        excludeIds.push(...r.map((p) => p._id));
      }
    }

    // Stage 3: giá ±100,000₫
    if (results.length < limit) {
      const r = await this.productModel.aggregate(
        buildPipeline(
          {
            basePrice: {
              $gte: current.basePrice - 100000,
              $lte: current.basePrice + 100000,
            },
          },
          limit - results.length,
        ),
      );
      results.push(...r);
      excludeIds.push(...r.map((p) => p._id));
    }

    // Stage 4: bất kỳ sản phẩm còn lại
    if (results.length < limit) {
      const r = await this.productModel.aggregate(
        buildPipeline({}, limit - results.length),
      );
      results.push(...r);
    }

    return results.slice(0, limit).map(format);
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

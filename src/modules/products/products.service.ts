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
import { Product, ProductImage } from './schemas/product.schema';
import { ProductVariant } from './schemas/product-variant.schema';
import { SlugGenerator } from '../../common/utils/slug.util';
import { Inventory } from '../inventory/schemas/inventory.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
    @InjectModel(ProductVariant.name) private readonly variantModel: Model<any>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<any>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
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
    try {
      return await session.withTransaction(async () => {
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

        const createdProduct = product[0] as any;

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
    if (categoryId) productFilter.categoryId = this.toObjectId(categoryId);

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
    if (categoryId) filter.categoryId = this.toObjectId(categoryId);

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
            const shop = inventory.shopId as any;

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
    updateProductDto: any,
    files: Express.Multer.File[], // File ảnh mới
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

    // Cập nhật slug nếu tên thay đổi
    let slug = product.slug;
    if (name && name !== product.name) {
      slug = SlugGenerator(name);
    }

    // 1. Xóa tham chiếu ảnh cũ khỏi DB
    let currentImages = [...product.images];
    const idsToDelete: string[] = deleteImageIds
      ? typeof deleteImageIds === 'string'
        ? JSON.parse(deleteImageIds)
        : deleteImageIds
      : [];

    if (idsToDelete.length > 0) {
      currentImages = currentImages.filter(
        (img: any) =>
          !idsToDelete.includes(img.id?.toString() || img._id?.toString()),
      ); // kiểm tra và lọc ra các ảnh cũ cần xóa theo id
    }

    // 2. Upload ảnh mới (nếu có files)
    let newUploadResults: ProductImage[] = [];
    if (files && files.length > 0) {
      newUploadResults = await this.cloudinary.uploadProductImages(
        files as Express.Multer.File[],
        slug,
      );
    }

    // Ghép ảnh cũ còn lại + ảnh mới
    const mergedImages = [...currentImages, ...newUploadResults];

    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
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
          const variantsList =
            typeof variants === 'string' ? JSON.parse(variants) : variants;

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
    } finally {
      await session.endSession();
    }
  }

  async remove(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    // SUPER_ADMIN thực hiện xóa mềm toàn hệ thống
    await this.productModel.findByIdAndUpdate(id, { deletedAt: new Date() }); // SOFT DELETE cho product
    await this.variantModel.updateMany(
      { productId: id },
      { deletedAt: new Date() }, // SOFT DELETE cho variant
    );

    return { message: 'Đã xóa sản phẩm thành công' };
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }
}

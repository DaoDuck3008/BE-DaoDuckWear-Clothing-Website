import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './schemas/product.schema';
import { ProductVariant } from './schemas/product-variant.schema';
import { Inventory } from './schemas/inventory.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Product.name) private readonly productModel: Model<any>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<any>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<any>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    const { name, categoryId, basePrice, description, status, variants } =
      createProductDto;

    const slug =
      createProductDto.slug ||
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    const existingProduct = await this.productModel.exists({ slug });
    if (existingProduct) {
      throw new BadRequestException('Sản phẩm đã tồn tại');
    }

    const duplicatedSku = await this.variantModel.exists({
      sku: { $in: variants.map((variant) => variant.sku) },
    });
    if (duplicatedSku) {
      throw new BadRequestException('SKU đã tồn tại trong hệ thống');
    }

    const uploadResults: any[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const fieldname = Buffer.from(file.fieldname, 'latin1').toString(
          'utf8',
        );

        let color: string | null = null;
        let isMain = false;

        if (fieldname.startsWith('color:')) {
          const parts = fieldname.split(':');
          const colorPart = parts[1].split('_')[0];
          color = colorPart;
          if (fieldname.endsWith('_0')) isMain = true;
        } else if (fieldname.startsWith('common_')) {
          if (fieldname === 'common_0') isMain = true;
        }

        // Đặt tên public_id có cấu trúc: slug/loai_mau_timestamp
        // VD: ao-thun-nam/color_den_1714000000000 | ao-thun-nam/common_1714000000000
        const typePrefix = color ? `color_${color.toLowerCase()}` : 'common';
        const publicId = `${slug}/${typePrefix}_${Date.now()}`;

        const uploadRes = await this.cloudinary.uploadImage(
          file,
          'products',
          publicId,
        );

        uploadResults.push({
          url: uploadRes.secure_url,
          publicId: uploadRes.public_id,
          color: color?.toUpperCase(),
          isMain,
          isThumbnail: file.fieldname === 'common_0',
        });
      }
    }

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
            : Number(basePrice);
          const upperColor = variantDto.color.toUpperCase();

          // Tìm ảnh khớp màu cho variant (ưu tiên ảnh isMain)
          const variantImage =
            uploadResults.find((img) => img.color === upperColor && img.isMain) ||
            uploadResults.find((img) => img.color === upperColor);

          await this.variantModel.create(
            [
              {
                productId: createdProduct._id,
                size: variantDto.size,
                color: upperColor,
                image: variantImage?.url || null,
                imagePublicId: variantImage?.publicId || null,
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
  }) {
    const { shopId, status, search } = query;
    const filter: any = { deletedAt: null };

    if (status) filter.status = status;
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Nếu có shopId, chỉ lấy sản phẩm có tồn kho tại shop đó
    if (shopId) {
      const productIds = await this.inventoryModel.distinct('productId', {
        shopId: this.toObjectId(shopId),
      });
      filter._id = { $in: productIds };
    }

    const products = await this.productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('categoryId');

    return products;
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
    files: Express.Multer.File[],
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

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
      slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
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
      );
    }

    // 2. Upload ảnh mới (nếu có files)
    const newUploadResults: any[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const fieldname = Buffer.from(file.fieldname, 'latin1').toString(
          'utf8',
        );

        let color: string | null = null;
        let isMain = false;

        if (fieldname.startsWith('color:')) {
          const parts = fieldname.split(':');
          const colorPart = parts[1].split('_')[0];
          color = colorPart;
          if (fieldname.endsWith('_0')) isMain = true;
        } else if (fieldname.startsWith('common_')) {
          if (fieldname === 'common_0') isMain = true;
        }

        // Đặt tên public_id có cấu trúc: slug/loai_mau_timestamp
        const typePrefix = color ? `color_${color.toLowerCase()}` : 'common';
        const publicId = `${slug}/${typePrefix}_${Date.now()}`;

        const uploadRes = await this.cloudinary.uploadImage(
          file,
          'products',
          publicId,
        );

        newUploadResults.push({
          url: uploadRes.secure_url,
          publicId: uploadRes.public_id,
          color: color?.toUpperCase() || null,
          isMain,
          isThumbnail: fieldname === 'common_0',
        });
      }
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

        // 4. Cập nhật Variants
        if (variants) {
          const variantsList =
            typeof variants === 'string' ? JSON.parse(variants) : variants;

          for (const v of variantsList) {
            if (v.id) {
              const upperColor = v.color?.toUpperCase();
              // Tìm ảnh khớp màu mới nhất từ danh sách đã gộp (ưu tiên ảnh isMain)
              const variantImage =
                mergedImages.find(
                  (img: any) => img.color === upperColor && img.isMain,
                ) || mergedImages.find((img: any) => img.color === upperColor);

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
    await this.productModel.findByIdAndUpdate(id, { deletedAt: new Date() });
    await this.variantModel.updateMany(
      { productId: id },
      { deletedAt: new Date() },
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

import { Injectable, BadRequestException } from '@nestjs/common';
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
    const {
      name,
      categoryId,
      shopId,
      basePrice,
      description,
      status,
      variants,
    } = createProductDto;

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

        const uploadRes = await this.cloudinary.uploadImage(
          file,
          'products',
          `${slug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        );

        uploadResults.push({
          url: uploadRes.secure_url,
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
              basePrice,
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

          const variant = await this.variantModel.create(
            [
              {
                productId: createdProduct._id,
                size: variantDto.size,
                color: upperColor,
                colorHexId: variantDto.colorHexId
                  ? this.toObjectId(variantDto.colorHexId)
                  : null,
                price: variantPrice,
                sku: variantDto.sku,
              },
            ],
            { session },
          );

          await this.inventoryModel.create(
            [
              {
                variantId: (variant[0] as any)._id,
                productId: createdProduct._id,
                shopId: this.toObjectId(shopId),
                quantity: Number(variantDto.stock),
                reservedQuantity: 0,
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
            inventoryJson.shop = inventoryJson.shopId;
            const shopId = inventory.shopId as any;
            inventoryJson.shopId = shopId._id?.toString
              ? shopId._id.toString()
              : inventory.shopId.toString();
            return inventoryJson;
          });
        return variantJson;
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

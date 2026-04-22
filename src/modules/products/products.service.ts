import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    const { name, categoryId, basePrice, description, status, variants } =
      createProductDto;

    // 1. Tạo Slug đơn giản
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

    // Kiểm tra trùng slug
    const existingProduct = await this.prisma.product.findFirst({
      where: { slug },
    });
    if (existingProduct) {
      throw new BadRequestException('Sản phẩm với slug này đã tồn tại');
    }

    // 4. Upload ảnh ngoài transaction trước để tránh timeout
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

    // 5. Bắt đầu Transaction để lưu DB
    return this.prisma.$transaction(
      async (tx) => {
        // Tạo Product
        const product = await tx.product.create({
          data: {
            name,
            slug,
            categoryId,
            basePrice,
            description,
            status: status || 'active',
          },
        });

        // Tạo Biến thể và Tồn kho
        for (const v of variants) {
          const variantPrice = v.price ? Number(v.price) : Number(basePrice);
          const upperColor = v.color.toUpperCase();

          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              size: v.size,
              color: upperColor,
              price: variantPrice,
              sku: v.sku,
            },
          });

          await tx.inventory.create({
            data: {
              variantId: variant.id,
              quantity: Number(v.stock),
            },
          });
        }

        // Lưu Image vào DB
        for (const res of uploadResults) {
          await tx.productImage.create({
            data: {
              productId: product.id,
              url: res.url,
              color: res.color,
              isMain: res.isMain,
              isThumbnail: res.isThumbnail,
            },
          });
        }

        return product;
      },
      {
        timeout: 30000,
      },
    );
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        variants: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!product) {
      throw new BadRequestException('Sản phẩm không tồn tại');
    }

    return product;
  }
}

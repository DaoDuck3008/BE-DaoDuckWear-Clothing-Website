import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product } from '../products/schemas/product.schema';
import { SlugGenerator } from '../../common/utils/slug.util';
import { BusinessException } from '../../common/exceptions/business.exception';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<any>,
  ) {}

  async findAllTree() {
    const categories = await this.categoryModel
      .find({ deletedAt: null })
      .sort({ name: 1 });

    return this.buildTree(categories.map((c) => c.toJSON()));
  }

  async findAllAdmin() {
    const raw = await this.categoryModel
      .find({ deletedAt: null })
      .populate('parentId', 'name')
      .lean();

    const mapped = (raw as any[]).map((c) => ({
      id: String(c._id),
      name: c.name as string,
      slug: c.slug as string,
      parent: c.parentId
        ? { id: String(c.parentId._id), name: c.parentId.name as string }
        : null,
      createdAt: c.createdAt,
    }));

    const collator = new Intl.Collator('vi');
    const roots = mapped
      .filter((c) => !c.parent)
      .sort((a, b) => collator.compare(a.name, b.name));

    const result: typeof mapped = [];
    for (const root of roots) {
      result.push(root);
      const children = mapped
        .filter((c) => c.parent?.id === root.id)
        .sort((a, b) => collator.compare(a.name, b.name));
      result.push(...children);
    }

    return result;
  }

  async create(dto: CreateCategoryDto) {
    const { name, parentId } = dto;

    if (parentId) {
      await this.validateParentId(parentId);
    }

    const slug = SlugGenerator(name);
    await this.ensureSlugUnique(slug);

    const category = await this.categoryModel.create({
      name,
      slug,
      parentId: parentId ? new Types.ObjectId(parentId) : null,
    });

    return { id: category._id, name: category.name, slug: category.slug };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryModel.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    const updateData: any = {};

    if (dto.name !== undefined) {
      const newSlug = SlugGenerator(dto.name);
      if (newSlug !== category.slug) {
        await this.ensureSlugUnique(newSlug, id);
        updateData.slug = newSlug;
      }
      updateData.name = dto.name;
    }

    if ('parentId' in dto) {
      if (dto.parentId) {
        if (dto.parentId === id) {
          throw new BadRequestException('Danh mục không thể là cha của chính nó');
        }
        await this.validateParentId(dto.parentId);
      }
      updateData.parentId = dto.parentId ? new Types.ObjectId(dto.parentId) : null;
    }

    await this.categoryModel.findByIdAndUpdate(id, { $set: updateData });
    return { message: 'Cập nhật danh mục thành công' };
  }

  async remove(id: string) {
    const category = await this.categoryModel.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    const hasProducts = await this.productModel.exists({
      categoryId: category._id,
      deletedAt: null,
    });
    if (hasProducts) {
      throw new BusinessException(
        'Không thể xóa danh mục đang có sản phẩm',
        'CATEGORY_HAS_PRODUCTS',
      );
    }

    await this.categoryModel.updateMany(
      { parentId: category._id },
      { $set: { parentId: null } },
    );

    await this.categoryModel.findByIdAndUpdate(id, {
      $set: { deletedAt: new Date() },
    });

    return { message: 'Xóa danh mục thành công' };
  }

  private async validateParentId(parentId: string) {
    const parent = await this.categoryModel.findOne({
      _id: parentId,
      deletedAt: null,
    });
    if (!parent) throw new NotFoundException('Danh mục cha không tồn tại');
    if (parent.parentId) {
      throw new BadRequestException(
        'Chỉ được chọn danh mục gốc làm danh mục cha (tối đa 2 cấp)',
      );
    }
  }

  private async ensureSlugUnique(slug: string, excludeId?: string) {
    const query: any = { slug, deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await this.categoryModel.findOne(query);
    if (existing) {
      throw new BadRequestException('Tên danh mục đã tồn tại (slug trùng)');
    }
  }

  private buildTree(categories: any[], parentId: string | null = null): any[] {
    return categories
      .filter((c) => {
        const pid = c.parentId ? c.parentId.toString() : null;
        return pid === parentId;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        children: this.buildTree(categories, c.id),
      }));
  }
}

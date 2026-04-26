import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findAllTree() {
    const categories = await this.categoryModel
      .find({ deletedAt: null })
      .sort({ name: 1 });

    return this.buildTree(categories.map((category) => category.toJSON()));
  }

  private buildTree(categories: any[], parentId: string | null = null): any[] {
    return categories
      .filter((category) => {
        const categoryParentId = category.parentId
          ? category.parentId.toString()
          : null;
        return categoryParentId === parentId;
      })
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        children: this.buildTree(categories, category.id),
      }));
  }
}

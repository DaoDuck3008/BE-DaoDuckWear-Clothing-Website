import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllTree() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    return this.buildTree(categories);
  }

  // Build tree structure from flat categories array
  private buildTree(categories: any[], parentId: string | null = null): any[] {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        children: this.buildTree(categories, cat.id),
      }));
  }
}

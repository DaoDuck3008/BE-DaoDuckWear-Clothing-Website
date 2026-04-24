import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.shop.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { name: 'desc' },
    });
  }
}

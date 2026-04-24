import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class ColorsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.color.findMany({
      orderBy: { name: 'asc' },
    });
  }
}

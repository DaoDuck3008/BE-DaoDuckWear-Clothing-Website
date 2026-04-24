import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Khi gửi qua FormData, các mảng object bị chuyển thành string JSON.
    // Parse lại để class-validator hoạt động chính xác.
    const createProductDto: CreateProductDto = {
      ...body,
      variants:
        typeof body.variants === 'string'
          ? JSON.parse(body.variants)
          : body.variants,
      basePrice: Number(body.basePrice),
    };

    return this.productsService.create(createProductDto, files);
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}

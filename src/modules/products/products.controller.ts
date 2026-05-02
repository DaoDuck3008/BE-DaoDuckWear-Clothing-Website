import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Get,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShopId } from '../../common/decorators/current-shop.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN toàn hệ thống mới có quyền tạo sản phẩm
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[], // Lấy ảnh từ form-data
  ) {
    const createProductDto: CreateProductDto = {
      // Ép kiểu dữ liệu từ JSON String về đúng kiểu dữ liệu thông qua DTO
      ...body,
      variants:
        typeof body.variants === 'string'
          ? JSON.parse(body.variants)
          : body.variants,
      basePrice: Number(body.basePrice),
    };

    return this.productsService.create(createProductDto, files);
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'SHOP_ADMIN')
  async findAllAdmin(@CurrentShopId() shopId: string, @Query() query: any) {
    return this.productsService.findAllAdmin({ shopId, ...query });
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN toàn hệ thống mới có quyền cập nhật sản phẩm
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentShopId() shopId: string,
  ) {
    return this.productsService.update(id, body, files);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN toàn hệ thống mới có quyền xóa sản phẩm
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}

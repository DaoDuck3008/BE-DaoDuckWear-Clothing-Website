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
import { multerImageOptions } from '../../common/utils/file-validation.util';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShopId } from '../../common/decorators/current-shop.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN toàn hệ thống mới có quyền tạo sản phẩm
  @UseInterceptors(AnyFilesInterceptor(multerImageOptions(10, 30)))
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    const createProductDto: CreateProductDto = {
      ...body,
      variants:
        typeof body.variants === 'string'
          ? JSON.parse(body.variants)
          : body.variants,
      basePrice: Number(body.basePrice),
    };

    return this.productsService.create(createProductDto, files, user.id);
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findAllAdmin(@CurrentShopId() shopId: string, @Query() query: any) {
    return this.productsService.findAllAdmin({ shopId, ...query });
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get(':slug/similar')
  async getSimilar(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.getSimilarProducts(slug, limit ? +limit : 5);
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN toàn hệ thống mới có quyền cập nhật sản phẩm
  @UseInterceptors(AnyFilesInterceptor(multerImageOptions(10, 30)))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    const updateProductDto: UpdateProductDto = {
      ...body,
      variants:
        typeof body.variants === 'string'
          ? JSON.parse(body.variants)
          : body.variants,
      deleteImageIds:
        typeof body.deleteImageIds === 'string'
          ? JSON.parse(body.deleteImageIds)
          : body.deleteImageIds,
      basePrice: body.basePrice ? Number(body.basePrice) : undefined,
    };

    return this.productsService.update(id, updateProductDto, files, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.id);
  }
}

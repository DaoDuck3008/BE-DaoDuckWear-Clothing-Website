import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerImageOptions } from '../../common/utils/file-validation.util';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // Lấy danh sách banner
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('position') position?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.bannersService.findAll({
      page,
      position,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // Lấy chi tiết banner
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  // Tạo banner
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 },
      ],
      multerImageOptions(10),
    ),
  )
  create(
    @Body() dto: CreateBannerDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
    @CurrentUser() user: any,
  ) {
    return this.bannersService.create(dto, files ?? {}, user.id);
  }

  @Patch(':id/toggle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bannersService.toggleStatus(id, user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 },
      ],
      multerImageOptions(10),
    ),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
    @CurrentUser() user: any,
  ) {
    return this.bannersService.update(id, dto, files ?? {}, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bannersService.remove(id, user.id);
  }
}

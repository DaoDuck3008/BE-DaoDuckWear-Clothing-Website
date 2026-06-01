import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShopId } from '../../common/decorators/current-shop.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateImportDto } from './dto/create-import.dto';
import { ListImportsDto } from './dto/list-imports.dto';
import { RevokeImportDto } from './dto/revoke-import.dto';

@Controller('inventory')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: any,
    @CurrentShopId() currentShopId: string,
    @Query() query: any,
  ) {
    const shopId = user.role === 'ADMIN' ? query.shopId : currentShopId;
    if (user.role !== 'ADMIN' && !shopId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh');
    }
    return this.inventoryService.findAllInventoryAdmin({ ...query, shopId });
  }

  @Post('imports')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async createImport(@CurrentUser() user: any, @Body() body: CreateImportDto) {
    return this.inventoryService.createImport(user, body);
  }

  @Get('imports')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async listImports(@CurrentUser() user: any, @Query() query: ListImportsDto) {
    return this.inventoryService.listImports(user, query);
  }

  @Get('imports/:id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async getImportDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.inventoryService.getImportDetail(user, id);
  }

  @Patch('imports/:id/revoke')
  @Roles('ADMIN', 'MANAGER')
  async revokeImport(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: RevokeImportDto,
  ) {
    return this.inventoryService.revokeImport(user, id, body);
  }

  @Get(':slug')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findOne(
    @CurrentUser() user: any,
    @CurrentShopId() currentShopId: string,
    @Param('slug') slug: string,
    @Query('shopId') queryShopId: string,
  ) {
    const shopId = user.role === 'ADMIN' ? queryShopId : currentShopId;
    if (user.role !== 'ADMIN' && !shopId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh');
    }
    return this.inventoryService.findOneProductInventory(slug, shopId);
  }
}

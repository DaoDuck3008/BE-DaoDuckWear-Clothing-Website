import {
  Controller,
  Get,
  Post,
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
    // Nếu không phải admin thì phải có shopId
    if (user.role !== 'ADMIN' && !shopId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh');
    }
    return this.inventoryService.findAllInventoryAdmin({ ...query, shopId });
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

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @CurrentUser() user: any,
    @CurrentShopId() currentShopId: string,
    @Body() body: any,
  ) {
    const shopId =
      user.role === 'ADMIN' ? body.shopId || currentShopId : currentShopId;
    if (!shopId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh');
    }
    const { productId, variantId, quantity } = body;
    if (!productId || !variantId || quantity === undefined) {
      throw new BadRequestException('Thiếu thông tin cập nhật tồn kho');
    }

    return this.inventoryService.updateInventory({
      shopId,
      productId,
      variantId,
      quantity: Number(quantity),
    });
  }
}

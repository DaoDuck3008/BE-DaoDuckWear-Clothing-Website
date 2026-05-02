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

@Controller('inventory')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(@CurrentShopId() shopId: string, @Query() query: any) {
    if (!shopId) {
      throw new BadRequestException('Tài khoản của bạn không thuộc chi nhánh nào');
    }
    return this.inventoryService.findAllInventoryAdmin({ shopId, ...query });
  }

  @Get(':slug')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findOne(
    @CurrentShopId() shopId: string,
    @Param('slug') slug: string,
  ) {
    if (!shopId) {
      throw new BadRequestException('Tài khoản của bạn không thuộc chi nhánh nào');
    }
    return this.inventoryService.findOneProductInventory(shopId, slug);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(@CurrentShopId() shopId: string, @Body() body: any) {
    if (!shopId) {
      throw new BadRequestException('Tài khoản của bạn không thuộc chi nhánh nào');
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

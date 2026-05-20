import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentShopId } from 'src/common/decorators/current-shop.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @UseGuards(AuthGuard)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.createOrder(createOrderDto, user.id);
  }

  @UseGuards(AuthGuard)
  @Get('my-orders')
  async findMyOrders(@CurrentUser() user: any, @Query() query: any) {
    return this.ordersService.findMyOrders(user.id, query);
  }

  @UseGuards(AuthGuard)
  @Patch('my-orders/:id/cancel')
  async cancelMyOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.cancelMyOrder(id, user.id);
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAllAdmin(@CurrentShopId() shopId: string, @Query() query: any) {
    return this.ordersService.findAllAdmin({ shopId, ...query });
  }

  @Get('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findOneAdmin(@Param('id') id: string, @CurrentShopId() shopId: string) {
    return this.ordersService.findOneAdmin(id, shopId);
  }

  @Get('admin/code/:orderCode')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findOneByCodeAdmin(
    @Param('orderCode') orderCode: string,
    @CurrentShopId() shopId: string,
  ) {
    return this.ordersService.findByCode(orderCode, shopId);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentShopId() shopId: string,
  ) {
    return this.ordersService.updateStatus(id, status, shopId);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findOneUser(id, user.id);
  }
}

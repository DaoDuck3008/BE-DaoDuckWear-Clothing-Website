import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    const userId = req.user.id;
    return this.ordersService.createOrder(createOrderDto, userId);
  }

  @UseGuards(AuthGuard)
  @Get('my-orders')
  async findMyOrders(@Req() req: any) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}

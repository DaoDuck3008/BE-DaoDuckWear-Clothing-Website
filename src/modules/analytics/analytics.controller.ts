import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentShopId } from '../../common/decorators/current-shop.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'STAFF')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(
    @CurrentShopId() shopId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSummary({ shopId, role, ...query });
  }

  @Get('revenue-series')
  getRevenueSeries(
    @CurrentShopId() shopId: string | null,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueSeries({ shopId, ...query });
  }

  @Get('orders-by-status')
  getOrdersByStatus(
    @CurrentShopId() shopId: string | null,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOrdersByStatus({ shopId, ...query });
  }

  @Get('top-products')
  getTopProducts(
    @CurrentShopId() shopId: string | null,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTopProducts({ shopId, ...query });
  }

  @Get('recent-orders')
  getRecentOrders(
    @CurrentShopId() shopId: string | null,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRecentOrders({ shopId, ...query });
  }

  @Get('products-by-category')
  getProductsByCategory(
    @CurrentShopId() shopId: string | null,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getProductsByCategory({ shopId, ...query });
  }
}

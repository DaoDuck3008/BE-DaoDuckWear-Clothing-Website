import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import {
  ListCustomerOrdersQueryDto,
  ListCustomerQueryDto,
} from './dto/customer.dto';

interface AuthUserPayload {
  id: string;
  role: string;
  shopId: string | null;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get('staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findStaff(
    @Query() query: ListStaffQueryDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.findAllStaff(query, user);
  }

  @Get('staff/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findStaffById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.findStaffById(id, user);
  }

  @Post('staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.createStaff(dto, user);
  }

  @Patch('staff/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.updateStaff(id, dto, user);
  }

  @Delete('staff/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async removeStaff(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.removeStaff(id, user);
  }

  @Post('staff/:id/reset-password')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async resetStaffPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.usersService.resetStaffPassword(id, user);
  }

  // ======================== CUSTOMER ROUTES ========================

  @Get('customers')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findCustomers(@Query() query: ListCustomerQueryDto) {
    return this.usersService.findAllCustomers(query);
  }

  @Get('customers/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findCustomerById(@Param('id') id: string) {
    return this.usersService.findCustomerById(id);
  }

  @Get('customers/:id/orders')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findCustomerOrders(
    @Param('id') id: string,
    @Query() query: ListCustomerOrdersQueryDto,
  ) {
    return this.usersService.findCustomerOrders(
      id,
      query.page ?? 1,
      query.limit ?? 5,
    );
  }

  @Patch('customers/:id/lock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async lockCustomer(@Param('id') id: string) {
    return this.usersService.setCustomerLock(id, true);
  }

  @Patch('customers/:id/unlock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async unlockCustomer(@Param('id') id: string) {
    return this.usersService.setCustomerLock(id, false);
  }
}

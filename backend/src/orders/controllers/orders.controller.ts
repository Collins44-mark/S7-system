import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from '../services/orders.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: BusinessPrincipal) {
    return this.orders.list(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: BusinessPrincipal, @Param('id') id: string) {
    return this.orders.getOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: BusinessPrincipal, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }
}

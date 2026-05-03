import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersRepository } from '../repositories/orders.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CheckoutError } from '../../core/errors/checkout.errors';

@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  list(user: BusinessPrincipal) {
    return this.orders.findAllForBusiness(user.sub);
  }

  async getOne(user: BusinessPrincipal, id: string) {
    const order = await this.orders.findOneForBusiness(user.sub, id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async create(user: BusinessPrincipal, dto: CreateOrderDto) {
    try {
      return await this.orders.createCheckoutTransaction(user.sub, dto);
    } catch (err) {
      if (err instanceof CheckoutError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}

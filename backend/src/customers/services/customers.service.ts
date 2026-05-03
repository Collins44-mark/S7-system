import { Injectable } from '@nestjs/common';
import { CustomersRepository } from '../repositories/customers.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  list(user: BusinessPrincipal) {
    return this.customers.findAllForBusiness(user.sub);
  }
}

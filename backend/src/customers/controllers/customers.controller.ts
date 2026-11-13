import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomersService } from '../services/customers.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DepositDto } from '../dto/deposit.dto';

@Controller('customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() user: BusinessPrincipal) {
    return this.customers.list(user);
  }

  @Get('accounts')
  accounts(@CurrentUser() user: BusinessPrincipal) {
    return this.customers.accounts(user);
  }

  @Get(':id/receipts')
  receipts(@CurrentUser() user: BusinessPrincipal, @Param('id') id: string) {
    return this.customers.receipts(user, id);
  }

  @Get(':id/account')
  accountHistory(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
  ) {
    return this.customers.accountHistory(user, id);
  }

  @Post('deposit')
  deposit(@CurrentUser() user: BusinessPrincipal, @Body() dto: DepositDto) {
    return this.customers.deposit(user, dto);
  }
}

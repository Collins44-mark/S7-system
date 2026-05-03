import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DebtsService } from '../services/debts.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { PayDebtDto } from '../dto/pay-debt.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('debts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Get()
  listOpen(@CurrentUser() user: BusinessPrincipal) {
    return this.debts.listOpen(user);
  }

  @Post(':id/pay')
  pay(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
    @Body() dto: PayDebtDto,
  ) {
    return this.debts.pay(user, id, dto);
  }
}

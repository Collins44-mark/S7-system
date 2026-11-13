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
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import { ExpensesService } from '../services/expenses.service';

@Controller('expenses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(
    @CurrentUser() user: BusinessPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expenses.list(user, from, to);
  }

  @Post()
  create(@CurrentUser() user: BusinessPrincipal, @Body() body: CreateExpenseDto) {
    return this.expenses.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
    @Body() body: UpdateExpenseDto,
  ) {
    return this.expenses.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: BusinessPrincipal, @Param('id') id: string) {
    return this.expenses.remove(user, id);
  }
}

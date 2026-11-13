import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpensesController } from './controllers/expenses.controller';
import { ExpensesRepository } from './repositories/expenses.repository';
import { ExpensesService } from './services/expenses.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesRepository],
})
export class ExpensesModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DebtsService } from './services/debts.service';
import { DebtsController } from './controllers/debts.controller';
import { DebtsRepository } from './repositories/debts.repository';

@Module({
  imports: [AuthModule],
  controllers: [DebtsController],
  providers: [DebtsService, DebtsRepository],
})
export class DebtsModule {}

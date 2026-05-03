import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DebtsRepository } from '../repositories/debts.repository';
import type { BusinessPrincipal } from '../../common/decorators/current-user.decorator';
import { PayDebtDto } from '../dto/pay-debt.dto';

@Injectable()
export class DebtsService {
  constructor(private readonly debts: DebtsRepository) {}

  listOpen(user: BusinessPrincipal) {
    return this.debts.findOpenForBusiness(user.sub);
  }

  async pay(user: BusinessPrincipal, debtId: string, dto: PayDebtDto) {
    try {
      const result = await this.debts.payDebtTransaction(
        user.sub,
        debtId,
        dto,
      );
      if (!result) {
        throw new NotFoundException('Debt not found or already settled');
      }
      return result;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      if (err instanceof Error) {
        if (err.message === 'INVALID_DEBT_AMOUNT') {
          throw new BadRequestException('Invalid payment amount');
        }
        if (err.message === 'DEBT_PAYMENT_EXCEEDS_BALANCE') {
          throw new BadRequestException('Payment exceeds balance owed');
        }
      }
      throw err;
    }
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductionController } from './controllers/production.controller';
import { ProductionRepository } from './repositories/production.repository';
import { ProductionService } from './services/production.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductionController],
  providers: [ProductionService, ProductionRepository],
})
export class ProductionModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemsService } from './services/items.service';
import { ItemsController } from './controllers/items.controller';
import { ItemsRepository } from './repositories/items.repository';

@Module({
  imports: [AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
})
export class ItemsModule {}

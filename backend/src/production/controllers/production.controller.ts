import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { CreateProductionDto } from '../dto/create-production.dto';
import { ProductionService } from '../services/production.service';

@Controller('production')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get()
  list(
    @CurrentUser() user: BusinessPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.production.list(user, from, to);
  }

  @Post()
  create(
    @CurrentUser() user: BusinessPrincipal,
    @Body() body: CreateProductionDto,
  ) {
    return this.production.create(user, body);
  }
}

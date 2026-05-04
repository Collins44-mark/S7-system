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
import { ItemsService } from '../services/items.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { RestockDto } from '../dto/restock.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('items')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(
    @CurrentUser() user: BusinessPrincipal,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.items.list(user, categoryId);
  }

  @Post()
  create(@CurrentUser() user: BusinessPrincipal, @Body() dto: CreateItemDto) {
    return this.items.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: BusinessPrincipal, @Param('id') id: string) {
    return this.items.remove(user, id);
  }

  @Post(':id/restock')
  restock(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
    @Body() dto: RestockDto,
  ) {
    return this.items.restock(user, id, dto.quantity, dto.notes);
  }
}

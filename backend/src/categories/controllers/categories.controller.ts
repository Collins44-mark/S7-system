import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoriesService } from '../services/categories.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('categories')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: BusinessPrincipal) {
    return this.categories.list(user);
  }

  @Post()
  create(@CurrentUser() user: BusinessPrincipal, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user, dto.name);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: BusinessPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(user, id, dto.name);
  }

  @Delete(':id')
  remove(@CurrentUser() user: BusinessPrincipal, @Param('id') id: string) {
    return this.categories.remove(user, id);
  }
}

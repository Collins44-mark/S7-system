import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ReportsService,
  type ReportPeriod,
} from '../services/reports.service';
import {
  CurrentUser,
  type BusinessPrincipal,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('BUSINESS')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: BusinessPrincipal) {
    return this.reports.dashboard(user);
  }

  @Get('sales')
  sales(
    @CurrentUser() user: BusinessPrincipal,
    @Query('period') period?: ReportPeriod,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.sales(user, period, from, to);
  }

  @Get('timeseries')
  timeseries(
    @CurrentUser() user: BusinessPrincipal,
    @Query('period') period: ReportPeriod = 'weekly',
  ) {
    return this.reports.timeseries(user, period);
  }

  @Get('restocks')
  restocks(
    @CurrentUser() user: BusinessPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.restocks(user, from, to);
  }
}

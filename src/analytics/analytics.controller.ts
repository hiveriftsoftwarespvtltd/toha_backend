import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Admin Analytics & Dashboard')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin Dashboard Overview KPIs' })
  async getDashboard() {
    const data = await this.analyticsService.getDashboardOverview();
    return { success: true, message: 'Dashboard metrics retrieved', data };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Admin Detailed Sales & Conversion Analytics' })
  async getAnalytics(@Query('period') period?: string) {
    const data = await this.analyticsService.getAnalyticsData(period || '30d');
    return { success: true, message: 'Analytics data retrieved', data };
  }
}

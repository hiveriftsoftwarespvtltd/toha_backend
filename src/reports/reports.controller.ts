import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Reports & Tax Calculations')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Admin: Get sales & revenue summary report' })
  async getSalesReport() {
    const data = await this.reportsService.getSalesReport();
    return { success: true, message: 'Sales report generated', data };
  }

  @Get('gst')
  @ApiOperation({ summary: 'Admin: Get GST 5% tax calculations report' })
  async getGstReport() {
    const data = await this.reportsService.getGstReport();
    return { success: true, message: 'GST report generated', data };
  }
}

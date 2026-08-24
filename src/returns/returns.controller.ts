import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { ReturnStatus, Role } from '../common/enums';

@ApiTags('Returns & Refunds')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: Submit item return request' })
  async createReturn(
    @CurrentUser() user: UserDocument,
    @Body() body: { orderId: string; productName: string; reason: string; refundAmount?: number },
  ) {
    const data = await this.returnsService.createReturnRequest(user._id.toString(), body);
    return { success: true, message: `Return request #${data.id} submitted successfully`, data };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: Get my return requests' })
  async getMyReturns(@CurrentUser() user: UserDocument) {
    const data = await this.returnsService.findUserReturns(user._id.toString());
    return { success: true, message: 'Returns retrieved', data };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all return requests' })
  async getAllAdminReturns() {
    const data = await this.returnsService.findAllAdminReturns();
    return { success: true, message: 'Admin returns list retrieved', data };
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update return request status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: ReturnStatus, @Body('adminNotes') adminNotes?: string) {
    const data = await this.returnsService.updateStatus(id, status, adminNotes);
    return { success: true, message: `Return request #${id} updated to ${status}`, data };
  }
}

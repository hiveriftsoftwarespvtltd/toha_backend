import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Payments & Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Razorpay payment order token' })
  async createRazorpayOrder(@Body() body: { amount: number; receipt: string }) {
    const data = await this.paymentsService.createRazorpayOrder(body.amount, body.receipt);
    return { success: true, message: 'Razorpay order created', data };
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Razorpay payment signature' })
  async verifyPayment(
    @Body() body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; orderId: string },
  ) {
    const data = await this.paymentsService.verifySignature(body);
    return { success: true, message: 'Payment verified successfully!', data };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all transaction payment logs' })
  async getAllAdminPayments() {
    const data = await this.paymentsService.findAllAdminPayments();
    return { success: true, message: 'Payment logs retrieved', data };
  }
}

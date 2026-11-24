import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MagicCheckoutService } from './magic-checkout.service';

@Controller('magic-checkout')
export class MagicCheckoutController {
  constructor(private readonly magicCheckoutService: MagicCheckoutService) {}

  /**
   * Health Check
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'Razorpay Magic Checkout Bridge',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 1. Shipping Info URL (Registered in Razorpay Dashboard -> Shipping Setup)
   * Method: POST
   */
  @Post('shipping')
  @HttpCode(HttpStatus.OK)
  async calculateShipping(@Body() body: any) {
    return await this.magicCheckoutService.calculateShipping(body);
  }

  /**
   * 2. Get Promotions URL (Registered in Razorpay Dashboard -> Checkout Setup)
   * Method: GET / POST
   */
  @Get('coupons')
  async getPromotionsGet(@Body() body: any) {
    return await this.magicCheckoutService.getPromotions(body);
  }

  @Post('coupons')
  @HttpCode(HttpStatus.OK)
  async getPromotionsPost(@Body() body: any) {
    return await this.magicCheckoutService.getPromotions(body);
  }

  /**
   * 3. Apply Promotions URL (Registered in Razorpay Dashboard -> Checkout Setup)
   * Method: POST
   */
  @Post('coupons/apply')
  @HttpCode(HttpStatus.OK)
  async applyPromotion(@Body() body: any) {
    return await this.magicCheckoutService.applyPromotion(body);
  }

  /**
   * 4. Create Razorpay Order
   * Called by Frontend before opening Magic Checkout drawer
   */
  @Post('create-order')
  @HttpCode(HttpStatus.OK)
  async createOrder(@Body() body: { amount: number; receipt?: string; notes?: Record<string, string> }) {
    return await this.magicCheckoutService.createMagicOrder(body);
  }

  /**
   * 5. Verify Payment Signature & Commit Order
   * Called by Frontend on Razorpay success handler
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Body()
    body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      orderPayload: any;
      userId?: string;
    },
  ) {
    return await this.magicCheckoutService.verifyMagicPayment(body);
  }
}

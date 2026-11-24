import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MagicCheckoutController } from './magic-checkout.controller';
import { MagicCheckoutService } from './magic-checkout.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Coupon, CouponSchema } from '../coupons/schemas/coupon.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    OrdersModule,
  ],
  controllers: [MagicCheckoutController],
  providers: [MagicCheckoutService],
  exports: [MagicCheckoutService],
})
export class MagicCheckoutModule {}

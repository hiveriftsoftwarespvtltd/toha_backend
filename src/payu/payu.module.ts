import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayuController } from './payu.controller';
import { PayuService } from './payu.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  InventoryAdjustment,
  InventoryAdjustmentSchema,
} from '../inventory/schemas/inventory-adjustment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
      { name: User.name, schema: UserSchema },
      { name: InventoryAdjustment.name, schema: InventoryAdjustmentSchema },
    ]),
  ],
  controllers: [PayuController],
  providers: [PayuService],
  exports: [PayuService],
})
export class PayuModule {}

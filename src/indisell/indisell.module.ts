import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IndiSellController } from './indisell.controller';
import { IndiSellService } from './indisell.service';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { InventoryAdjustment, InventoryAdjustmentSchema } from '../inventory/schemas/inventory-adjustment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: InventoryAdjustment.name, schema: InventoryAdjustmentSchema },
    ]),
  ],
  controllers: [IndiSellController],
  providers: [IndiSellService],
  exports: [IndiSellService],
})
export class IndiSellModule {}

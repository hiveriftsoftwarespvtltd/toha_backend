import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { ReturnRequest, ReturnRequestSchema } from './schemas/return.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReturnRequest.name, schema: ReturnRequestSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService, MongooseModule],
})
export class ReturnsModule {}

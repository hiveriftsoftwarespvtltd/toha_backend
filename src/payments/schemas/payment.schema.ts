import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PaymentStatus } from '../../common/enums';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  txnId: string; // e.g. TXN-99410

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true })
  method: string;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  status: PaymentStatus;

  @Prop({ default: '' })
  gatewayTxnId: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ReturnStatus } from '../../common/enums';

export type ReturnRequestDocument = ReturnRequest & Document;

@Schema({ timestamps: true })
export class ReturnRequest {
  @Prop({ required: true, unique: true, index: true })
  id: string; // e.g. RET-101

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  customerEmail: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true, type: Number })
  refundAmount: number;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: String, enum: ReturnStatus, default: ReturnStatus.REQUESTED, index: true })
  status: ReturnStatus;

  @Prop({ default: '' })
  adminNotes: string;
}

export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);

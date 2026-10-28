import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IndiSellSessionDocument = IndiSellSession & Document;

@Schema({ timestamps: true })
export class IndiSellSession {
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, unique: true, index: true })
  sessionHash: string; // sha256(checkoutSessionId)

  @Prop({ required: true })
  checkoutSessionId: string;

  @Prop({ required: true })
  cartId: string;

  @Prop({ required: true })
  cartVersion: string;

  @Prop({ default: 'created' })
  status: string; // 'created' | 'completed' | 'abandoned'

  @Prop({ default: null })
  orderId: string;
}

export const IndiSellSessionSchema = SchemaFactory.createForClass(IndiSellSession);
// Expire sessions after 48 hours
IndiSellSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 48 * 3600 });

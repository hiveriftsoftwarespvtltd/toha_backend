import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IndiSellIdempotencyDocument = IndiSellIdempotency & Document;

@Schema({ timestamps: true })
export class IndiSellIdempotency {
  @Prop({ required: true, unique: true, index: true })
  key: string; // merchantKey + ':' + action + ':' + requestId

  @Prop({ required: true })
  merchantKey: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  requestId: string;

  @Prop({ required: true })
  payloadHash: string;

  @Prop({ type: Object, required: true })
  response: any;

  @Prop({ default: 200 })
  statusCode: number;
}

export const IndiSellIdempotencySchema = SchemaFactory.createForClass(IndiSellIdempotency);
// Expire idempotency records after 7 days
IndiSellIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

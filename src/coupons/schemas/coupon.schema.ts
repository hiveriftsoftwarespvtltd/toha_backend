import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CouponType } from '../../common/enums';

export type CouponDocument = Coupon & Document;

@Schema({ timestamps: true })
export class Coupon {
  @Prop({ required: true, unique: true, index: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: String, enum: CouponType, default: CouponType.PERCENTAGE })
  type: CouponType;

  @Prop({ required: true, type: Number })
  value: number; // percentage value or flat amount

  @Prop({ default: 0, type: Number })
  minimumOrderValue: number;

  @Prop({ default: 1000, type: Number })
  maximumDiscount: number;

  @Prop({ default: 1000, type: Number })
  usageLimit: number;

  @Prop({ default: 0, type: Number })
  usedCount: number;

  @Prop({ default: 5, type: Number })
  perUserLimit: number;

  @Prop({ default: 'Active', index: true })
  status: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  expiryDate: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

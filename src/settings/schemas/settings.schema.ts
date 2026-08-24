import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoreSettingsDocument = StoreSettings & Document;

@Schema({ _id: false })
export class PaymentGatewaysConfig {
  @Prop({ default: true })
  razorpay: boolean;

  @Prop({ default: true })
  phonepe: boolean;

  @Prop({ default: true })
  paytm: boolean;

  @Prop({ default: true })
  cod: boolean;
}

const PaymentGatewaysConfigSchema = SchemaFactory.createForClass(PaymentGatewaysConfig);

@Schema({ timestamps: true })
export class StoreSettings {
  @Prop({ default: 'Tohay Kids Festive Wear' })
  storeName: string;

  @Prop({ default: 'admin@tohaykids.com' })
  contactEmail: string;

  @Prop({ default: '+91 98765 43210' })
  supportPhone: string;

  @Prop({ default: '₹' })
  currencySymbol: string;

  @Prop({ default: 'INR' })
  currencyCode: string;

  @Prop({ default: 'Plot 42, Textile Hub, Sector 62, Noida, UP 201301' })
  address: string;

  @Prop({ default: 1499, type: Number })
  freeShippingThreshold: number;

  @Prop({ default: 99, type: Number })
  standardShippingFee: number;

  @Prop({ default: 5, type: Number })
  gstTaxRate: number;

  @Prop({ type: PaymentGatewaysConfigSchema, default: () => ({ razorpay: true, phonepe: true, paytm: true, cod: true }) })
  paymentGateways: PaymentGatewaysConfig;
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings);

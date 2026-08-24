import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { OrderStatus, PaymentStatus } from '../../common/enums';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true, type: Number })
  qty: number;

  @Prop({ required: true })
  size: string;

  @Prop({ default: '' })
  image: string;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class OrderTimeline {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  date: string;

  @Prop({ default: false })
  completed: boolean;

  @Prop({ default: '' })
  note: string;
}

const OrderTimelineSchema = SchemaFactory.createForClass(OrderTimeline);

@Schema({ _id: false })
export class OrderCourier {
  @Prop({ default: 'BlueDart / Delhivery' })
  name: string;

  @Prop({ default: '' })
  trackingNumber: string;
}

const OrderCourierSchema = SchemaFactory.createForClass(OrderCourier);

@Schema({ _id: false })
export class OrderAddress {
  @Prop({ default: '' })
  flat: string;

  @Prop({ default: '' })
  street: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ default: '' })
  state: string;

  @Prop({ default: '' })
  pincode: string;
}

const OrderAddressSchema = SchemaFactory.createForClass(OrderAddress);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  id: string; // e.g. TK10482 or TH-10495

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  customerEmail: string;

  @Prop({ default: '' })
  customerPhone: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, type: Number })
  itemsCount: number;

  @Prop({ required: true, type: Number })
  subtotal: number;

  @Prop({ default: 0, type: Number })
  discount: number;

  @Prop({ default: 0, type: Number })
  shipping: number;

  @Prop({ default: 0, type: Number })
  tax: number;

  @Prop({ required: true, type: Number })
  totalAmount: number;

  @Prop({ default: 'Cash on Delivery' })
  paymentMethod: string;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  paymentStatus: PaymentStatus;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PROCESSING, index: true })
  orderStatus: OrderStatus;

  @Prop({ type: OrderAddressSchema, required: true })
  shippingAddress: OrderAddress;

  @Prop({ type: [OrderTimelineSchema], default: [] })
  timeline: OrderTimeline[];

  @Prop({ type: OrderCourierSchema, default: () => ({ name: 'BlueDart Express', trackingNumber: '' }) })
  courier: OrderCourier;

  @Prop({ default: '' })
  razorpayOrderId: string;

  @Prop({ default: '' })
  razorpayPaymentId: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

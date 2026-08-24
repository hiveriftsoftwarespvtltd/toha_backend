import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CartDocument = Cart & Document;

@Schema({ _id: false })
export class CartItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  product: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  size: string;

  @Prop({ default: null })
  child1Size: string;

  @Prop({ default: null })
  child2Size: string;

  @Prop({ required: true, type: Number, min: 1 })
  qty: number;
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ default: '' })
  couponCode: string;

  @Prop({ default: 'PERCENTAGE' })
  discountType: string;

  @Prop({ default: 0, type: Number })
  discountValue: number;

  @Prop({ default: 0, type: Number })
  discountPercent: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

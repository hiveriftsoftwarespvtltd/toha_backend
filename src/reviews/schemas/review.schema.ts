import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', index: true })
  product: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true, type: Number, min: 1, max: 5 })
  rating: number;

  @Prop({ default: '' })
  title: string;

  @Prop({ required: true })
  comment: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: 'Approved', index: true })
  status: string; // Approved, Pending, Rejected

  @Prop({ default: true })
  isVerifiedPurchase: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

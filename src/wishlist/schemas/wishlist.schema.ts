import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WishlistDocument = Wishlist & Document;

@Schema({ timestamps: true })
export class Wishlist {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: [String], default: [] })
  productIds: string[];
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);

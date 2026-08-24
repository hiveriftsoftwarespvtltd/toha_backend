import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BrandDocument = Brand & Document;

@Schema({ timestamps: true })
export class Brand {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ default: 0, type: Number })
  productsCount: number;

  @Prop({ default: 'Active', index: true })
  status: string;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug: string;

  @Prop({ default: 'Main' })
  parentCategory: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  subcategories: string[];

  @Prop({ default: 0, type: Number })
  productsCount: number;

  @Prop({ default: 'Active', index: true })
  status: string;

  @Prop({ default: 0, type: Number })
  sortOrder: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

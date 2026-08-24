import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductColor {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  hex: string;
}

const ProductColorSchema = SchemaFactory.createForClass(ProductColor);

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, index: true, lowercase: true })
  slug: string;

  @Prop({ required: true, index: true })
  category: string; // e.g. Girls, Boys, Siblings

  @Prop({ default: '', index: true })
  subcategory: string; // e.g. Lehenga Choli, Party Gowns, Kurta Sets

  @Prop({ default: '', index: true })
  collectionName: string; // e.g. Festive, Wedding, Party

  @Prop({ default: 'TH-HERITAGE', index: true })
  brand: string;

  @Prop({ required: true, index: true })
  ageRange: string; // e.g. 0-8, 9-12, 13-16

  @Prop({ type: [String], default: [] })
  sizes: string[];

  @Prop({ type: [ProductColorSchema], default: [] })
  colors: ProductColor[];

  @Prop({ required: true, type: Number, index: true })
  price: number;

  @Prop({ required: true, type: Number })
  mrp: number;

  @Prop({ default: 5.0, type: Number })
  rating: number;

  @Prop({ default: 0, type: Number })
  reviewsCount: number;

  @Prop({ default: false, index: true })
  isNew: boolean;

  @Prop({ default: false, index: true })
  isTrending: boolean;

  @Prop({ default: false, index: true })
  isBestseller: boolean;

  @Prop({ default: false, index: true })
  isSale: boolean;

  @Prop({ default: 10, type: Number, index: true })
  stock: number;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ default: '' })
  shortDescription: string;

  @Prop({ default: 'Pure Silk Blend' })
  fabric: string;

  @Prop({ default: 'Dry Clean Only' })
  care: string;

  @Prop({ default: 'Festive' })
  occasion: string;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ isActive: 1, createdAt: -1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ isSale: 1, isActive: 1 });
ProductSchema.index({ isNew: 1, isActive: 1 });
ProductSchema.index({ isTrending: 1, isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ price: -1 });
ProductSchema.index({ rating: -1 });
ProductSchema.index({ name: 'text', shortDescription: 'text', fabric: 'text' });


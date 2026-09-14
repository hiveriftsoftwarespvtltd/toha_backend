import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  highlightTitle: string;

  @Prop({ default: '' })
  subtitle: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  btnPrimaryText: string;

  @Prop({ default: '' })
  btnPrimaryLink: string;

  @Prop({ default: '' })
  btnSecondaryText: string;

  @Prop({ default: '' })
  btnSecondaryLink: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: '' })
  placement: string;

  @Prop({ type: [String], default: [] })
  additionalImages: string[];

  @Prop({ default: '' })
  startDate: string;

  @Prop({ default: '' })
  endDate: string;

  @Prop({ default: '' })
  mobileImage: string;

  @Prop({ default: '/collections' })
  link: string;

  @Prop({ default: 'Hero Slider' })
  position: string; // Hero Slider, Sale Banner, Sub Banner

  @Prop({ default: 'Active', index: true })
  status: string;

  @Prop({ default: 0, type: Number })
  sortOrder: number;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

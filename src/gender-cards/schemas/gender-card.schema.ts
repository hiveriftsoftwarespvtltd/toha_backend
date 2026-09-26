import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GenderCardDocument = GenderCard & Document;

@Schema({ timestamps: true })
export class GenderCard {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, trim: true, index: true })
  slotKey: string; // e.g. "Homepage Girls Card", "Homepage Boys Card", "Homepage Siblings Card"

  @Prop({ required: true, trim: true })
  name: string; // e.g. "Girls Promo Card"

  @Prop({ required: true, trim: true })
  title: string; // e.g. "Girls"

  @Prop({ default: '' })
  subtitle: string;

  @Prop({ default: '' })
  btnPrimaryText: string;

  @Prop({ default: '' })
  btnPrimaryLink: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: 'Active', index: true })
  status: string;

  @Prop({ default: 0, type: Number })
  sortOrder: number;
}

export const GenderCardSchema = SchemaFactory.createForClass(GenderCard);

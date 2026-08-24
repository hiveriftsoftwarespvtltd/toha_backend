import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { StockAdjustmentType } from '../../common/enums';

export type InventoryAdjustmentDocument = InventoryAdjustment & Document;

@Schema({ timestamps: true })
export class InventoryAdjustment {
  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true, type: Number })
  previousStock: number;

  @Prop({ required: true, type: Number })
  adjustment: number;

  @Prop({ required: true, type: Number })
  newStock: number;

  @Prop({ type: String, enum: StockAdjustmentType, default: StockAdjustmentType.MANUAL_ADJUSTMENT })
  type: StockAdjustmentType;

  @Prop({ default: 'Manual Adjustment' })
  reason: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  admin: MongooseSchema.Types.ObjectId;
}

export const InventoryAdjustmentSchema = SchemaFactory.createForClass(InventoryAdjustment);

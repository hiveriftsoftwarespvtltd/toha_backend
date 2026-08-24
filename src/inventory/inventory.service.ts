import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryAdjustment, InventoryAdjustmentDocument } from './schemas/inventory-adjustment.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { StockAdjustmentType } from '../common/enums';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryAdjustment.name) private inventoryModel: Model<InventoryAdjustmentDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async getInventoryList() {
    return await this.productModel.find().select('id name category subcategory price stock isSale rating').sort({ stock: 1 }).exec();
  }

  async getLowStockProducts(threshold = 10) {
    return await this.productModel.find({ stock: { $lte: threshold } }).exec();
  }

  async adjustStock(productId: string, adjustmentQty: number, reason = 'Manual Adjustment') {
    const product = await this.productModel.findOne({ id: productId }).exec();
    if (!product) throw new NotFoundException(`Product #${productId} not found`);

    const prevStock = product.stock || 0;
    const newStock = Math.max(0, prevStock + adjustmentQty);
    product.stock = newStock;
    await product.save();

    const log = new this.inventoryModel({
      productId: product.id,
      productName: product.name,
      previousStock: prevStock,
      adjustment: adjustmentQty,
      newStock,
      type: StockAdjustmentType.MANUAL_ADJUSTMENT,
      reason,
    });
    await log.save();

    return { product, log };
  }

  async getLogsForProduct(productId: string) {
    return await this.inventoryModel.find({ productId }).sort({ createdAt: -1 }).exec();
  }
}

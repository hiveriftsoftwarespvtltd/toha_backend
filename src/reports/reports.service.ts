import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

@Injectable()
export class ReportsService {
  constructor(@InjectModel(Order.name) private orderModel: Model<OrderDocument>) {}

  async getSalesReport() {
    const orders = await this.orderModel.find().exec();
    const totalOrders = orders.length;
    const grossSales = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const discounts = orders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const netSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalTax = orders.reduce((sum, o) => sum + (o.tax || 0), 0);

    return {
      totalOrders,
      grossSales,
      discounts,
      netSales,
      totalTax,
      ordersSummary: orders.slice(0, 10),
    };
  }

  async getGstReport() {
    const orders = await this.orderModel.find({ paymentStatus: 'PAID' }).exec();
    const totalTaxableAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const gstRate = 5; // 5% GST
    const totalGstCollected = Math.round((totalTaxableAmount * gstRate) / 105);

    return {
      gstRate: '5%',
      taxableAmount: totalTaxableAmount,
      totalGstCollected,
      ordersCount: orders.length,
    };
  }
}

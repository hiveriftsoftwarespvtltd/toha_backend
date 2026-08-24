import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReturnRequest, ReturnRequestDocument } from './schemas/return.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { ReturnStatus } from '../common/enums';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectModel(ReturnRequest.name) private returnModel: Model<ReturnRequestDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async createReturnRequest(userId: string, data: { orderId: string; productName: string; reason: string; refundAmount?: number }) {
    const order = await this.orderModel.findOne({ id: data.orderId }).exec();
    if (!order) throw new NotFoundException(`Order #${data.orderId} not found`);

    const id = `RET-${Date.now().toString().slice(-4)}`;
    const newReturn = new this.returnModel({
      id,
      orderId: order.id,
      user: userId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      productName: data.productName,
      refundAmount: data.refundAmount || order.totalAmount,
      reason: data.reason,
      status: ReturnStatus.REQUESTED,
    });

    return await newReturn.save();
  }

  async findUserReturns(userId: string) {
    return await this.returnModel.find({ user: userId }).sort({ createdAt: -1 }).exec();
  }

  async findAllAdminReturns() {
    return await this.returnModel.find().sort({ createdAt: -1 }).exec();
  }

  async updateStatus(id: string, status: ReturnStatus, adminNotes?: string) {
    const ret = await this.returnModel.findOneAndUpdate({ id }, { status, adminNotes }, { new: true }).exec();
    if (!ret) throw new NotFoundException(`Return request #${id} not found`);
    return ret;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async updateProfile(userId: string, updatedFields: Partial<User>) {
    const user = await this.userModel.findByIdAndUpdate(userId, updatedFields, { new: true }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const obj = user.toObject();
    delete obj.passwordHash;
    return obj;
  }

  async findAllCustomers(query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = { role: 'CUSTOMER' };
    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { email: new RegExp(query.search, 'i') },
        { phone: new RegExp(query.search, 'i') },
      ];
    }

    const [total, users] = await Promise.all([
      this.userModel.countDocuments(filter).exec(),
      this.userModel.find(filter).skip(skip).limit(limit).exec(),
    ]);

    // Enhance each customer with sales/orders metrics for admin CRM table
    const customersWithMetrics = await Promise.all(
      users.map(async (u) => {
        const userOrders = await this.orderModel.find({ customerEmail: u.email }).exec();
        const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalOrders = userOrders.length;
        const lastOrderDate = userOrders.length > 0 ? (userOrders[0] as any).createdAt : null;

        const obj = u.toObject();
        delete obj.passwordHash;

        return {
          id: u._id.toString(),
          ...obj,
          totalSpent,
          ordersCount: totalOrders,
          totalOrders,
          lastOrderDate,
        };
      }),
    );

    return {
      data: customersWithMetrics,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Customer not found');
    }
    const obj = user.toObject();
    delete obj.passwordHash;
    return obj;
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { id };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon, CouponDocument } from './schemas/coupon.schema';

@Injectable()
export class CouponsService {
  constructor(@InjectModel(Coupon.name) private couponModel: Model<CouponDocument>) {}

  async findAll() {
    return await this.couponModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const coupon = await this.couponModel.findOne({ $or: [{ id }, { code: id.toUpperCase() }] }).exec();
    if (!coupon) throw new NotFoundException(`Coupon #${id} not found`);
    return coupon;
  }

  async create(data: any) {
    const code = data.code?.trim().toUpperCase();
    const existing = await this.couponModel.findOne({ code }).exec();
    if (existing) throw new BadRequestException(`Coupon with code "${code}" already exists`);

    let type = data.type || data.discountType || 'PERCENTAGE';
    if (type === 'Fixed Amount' || type === 'FIXED_AMOUNT') type = 'FIXED';
    if (type === 'Percentage') type = 'PERCENTAGE';
    if (type === 'Free Shipping') type = 'FREE_SHIPPING';

    const val = Number(data.value ?? data.discountValue ?? 0);
    const minOrder = Number(data.minimumOrderValue ?? data.minOrderValue ?? 0);
    const limit = Number(data.usageLimit ?? 1000);

    const created = new this.couponModel({
      id: `coup-${Date.now()}`,
      code,
      title: data.title || `${code} Discount Coupon`,
      type,
      discountType: data.discountType || (type === 'FIXED' ? 'Fixed Amount' : 'Percentage'),
      value: val,
      discountValue: val,
      minimumOrderValue: minOrder,
      minOrderValue: minOrder,
      usageLimit: limit,
      usedCount: data.usedCount || 0,
      status: data.status || 'Active',
      isActive: data.isActive !== false,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    });
    return await created.save();
  }

  async update(id: string, data: any) {
    const isMongoId = id.match(/^[0-9a-fA-F]{24}$/);
    const filterConditions: any[] = [{ id }, { code: id.toUpperCase() }];
    if (isMongoId) {
      filterConditions.push({ _id: id });
    }

    let type = data.type || data.discountType;
    if (type === 'Fixed Amount' || type === 'FIXED_AMOUNT') type = 'FIXED';
    if (type === 'Percentage') type = 'PERCENTAGE';
    if (type === 'Free Shipping') type = 'FREE_SHIPPING';

    const val = data.value ?? data.discountValue;
    const minOrder = data.minimumOrderValue ?? data.minOrderValue;

    const updatePayload: any = { ...data };
    if (type) {
      updatePayload.type = type;
      updatePayload.discountType = data.discountType || (type === 'FIXED' ? 'Fixed Amount' : 'Percentage');
    }
    if (val !== undefined) {
      updatePayload.value = Number(val);
      updatePayload.discountValue = Number(val);
    }
    if (minOrder !== undefined) {
      updatePayload.minimumOrderValue = Number(minOrder);
      updatePayload.minOrderValue = Number(minOrder);
    }

    const updated = await this.couponModel.findOneAndUpdate({ $or: filterConditions }, updatePayload, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Coupon #${id} not found`);
    return updated;
  }

  async remove(id: string) {
    if (!id || id === 'undefined') {
      return { id };
    }
    const isMongoId = id.match(/^[0-9a-fA-F]{24}$/);
    const filterConditions: any[] = [{ id }, { code: id.toUpperCase() }];
    if (isMongoId) {
      filterConditions.push({ _id: id });
    }

    const deleted = await this.couponModel.findOneAndDelete({ $or: filterConditions }).exec();
    return { id: deleted?.id || id };
  }

  async validateCoupon(code: string, cartTotal: number) {
    const cleanCode = code.trim().toUpperCase();
    const coupon = await this.couponModel.findOne({ code: cleanCode, isActive: true }).exec();

    if (!coupon) {
      if (cleanCode === 'PREPAIDS') {
        return { valid: true, code: 'PREPAIDS', value: 5, message: '5% Extra Prepaid Discount applied!' };
      }
      if (cleanCode === 'TOHAY10') {
        return { valid: true, code: 'TOHAY10', value: 10, message: '10% Festive Discount applied!' };
      }
      throw new BadRequestException('Invalid or expired coupon code');
    }

    if (cartTotal < coupon.minimumOrderValue) {
      throw new BadRequestException(`Minimum cart total of ₹${coupon.minimumOrderValue} required for this coupon`);
    }

    return {
      valid: true,
      code: coupon.code,
      value: coupon.value,
      type: coupon.type,
      message: `${coupon.value}% Discount applied!`,
    };
  }
}

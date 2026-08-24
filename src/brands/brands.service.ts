import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand, BrandDocument } from './schemas/brand.schema';

@Injectable()
export class BrandsService {
  constructor(@InjectModel(Brand.name) private brandModel: Model<BrandDocument>) {}

  async findAll() {
    return await this.brandModel.find().exec();
  }

  async findOne(id: string) {
    const brand = await this.brandModel.findOne({ id }).exec();
    if (!brand) throw new NotFoundException(`Brand #${id} not found`);
    return brand;
  }

  async create(data: Partial<Brand>) {
    const id = `b-${Date.now()}`;
    const code = data.code || `TH-${data.name?.toUpperCase().replace(/\s+/g, '')}`;
    const newBrand = new this.brandModel({ id, code, status: 'Active', productsCount: 0, ...data });
    return await newBrand.save();
  }

  async update(id: string, fields: Partial<Brand>) {
    const updated = await this.brandModel.findOneAndUpdate({ id }, fields, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Brand #${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.brandModel.findOneAndDelete({ id }).exec();
    if (!deleted) throw new NotFoundException(`Brand #${id} not found`);
    return { id };
  }
}

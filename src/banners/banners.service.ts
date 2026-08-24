import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';

@Injectable()
export class BannersService {
  constructor(@InjectModel(Banner.name) private bannerModel: Model<BannerDocument>) {}

  async findAll() {
    return await this.bannerModel.find().sort({ sortOrder: 1, createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const banner = await this.bannerModel.findOne({ id }).exec();
    if (!banner) throw new NotFoundException(`Banner #${id} not found`);
    return banner;
  }

  async create(data: Partial<Banner> & Record<string, any>) {
    const id = data.id || `ban-${Date.now()}`;
    const img = data.image || data.imageUrl || '';
    const imgUrl = data.imageUrl || data.image || '';
    const newBanner = new this.bannerModel({
      id,
      status: 'Active',
      sortOrder: 0,
      ...data,
      image: img,
      imageUrl: imgUrl,
    });
    return await newBanner.save();
  }

  async update(id: string, fields: Partial<Banner> & Record<string, any>) {
    const filter = {
      $or: [
        { id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
      ],
    };
    if (fields.imageUrl && !fields.image) {
      fields.image = fields.imageUrl;
    }
    if (fields.image && !fields.imageUrl) {
      fields.imageUrl = fields.image;
    }
    const updated = await this.bannerModel.findOneAndUpdate(filter, fields, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Banner #${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const filter = {
      $or: [
        { id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
      ],
    };
    const deleted = await this.bannerModel.findOneAndDelete(filter).exec();
    if (!deleted) throw new NotFoundException(`Banner #${id} not found`);
    return { id };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenderCard, GenderCardDocument } from './schemas/gender-card.schema';

@Injectable()
export class GenderCardsService {
  constructor(
    @InjectModel(GenderCard.name)
    private genderCardModel: Model<GenderCardDocument>,
  ) {}

  async findAll() {
    return await this.genderCardModel
      .find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
  }

  async findOne(id: string) {
    const card = await this.genderCardModel
      .findOne({
        $or: [
          { id },
          ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
          { slotKey: id },
        ],
      })
      .exec();
    if (!card) throw new NotFoundException(`GenderCard #${id} not found`);
    return card;
  }

  async create(data: Partial<GenderCard> & Record<string, any>) {
    const slotKey = data.slotKey || 'Homepage Girls Card';
    const id = data.id || `gc-${Date.now()}`;
    const img = data.imageUrl || data.image || '';

    // Check if a card already exists with this slotKey, if so update it
    const existing = await this.genderCardModel.findOne({ slotKey }).exec();
    if (existing) {
      return await this.update(existing.id || existing._id.toString(), data);
    }

    const newCard = new this.genderCardModel({
      id,
      status: 'Active',
      sortOrder: 0,
      ...data,
      slotKey,
      image: img,
      imageUrl: img,
    });
    return await newCard.save();
  }

  async update(id: string, fields: Partial<GenderCard> & Record<string, any>) {
    const filter = {
      $or: [
        { id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
        ...(fields.slotKey ? [{ slotKey: fields.slotKey }] : []),
      ],
    };

    if (fields.imageUrl && !fields.image) {
      fields.image = fields.imageUrl;
    }
    if (fields.image && !fields.imageUrl) {
      fields.imageUrl = fields.image;
    }

    const updated = await this.genderCardModel
      .findOneAndUpdate(filter, fields, { new: true, upsert: true })
      .exec();
    return updated;
  }

  async remove(id: string) {
    const filter = {
      $or: [
        { id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
      ],
    };
    const deleted = await this.genderCardModel.findOneAndDelete(filter).exec();
    if (!deleted) throw new NotFoundException(`GenderCard #${id} not found`);
    return { id };
  }
}

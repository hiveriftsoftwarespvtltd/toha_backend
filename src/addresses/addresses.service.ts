import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Address, AddressDocument } from './schemas/address.schema';

@Injectable()
export class AddressesService {
  constructor(@InjectModel(Address.name) private addressModel: Model<AddressDocument>) {}

  async findAllByUser(userId: string) {
    return await this.addressModel.find({ user: userId }).exec();
  }

  async create(userId: string, data: Partial<Address>) {
    const existingCount = await this.addressModel.countDocuments({ user: userId }).exec();
    const newAddr = new this.addressModel({
      user: userId,
      isDefault: existingCount === 0 || data.isDefault === true,
      ...data,
    });
    return await newAddr.save();
  }

  async update(userId: string, id: string, data: Partial<Address>) {
    const addr = await this.addressModel.findOneAndUpdate({ _id: id, user: userId }, data, { new: true }).exec();
    if (!addr) throw new NotFoundException('Address not found');
    return addr;
  }

  async remove(userId: string, id: string) {
    const addr = await this.addressModel.findOneAndDelete({ _id: id, user: userId }).exec();
    if (!addr) throw new NotFoundException('Address not found');
    return { id };
  }

  async setDefault(userId: string, id: string) {
    await this.addressModel.updateMany({ user: userId }, { isDefault: false }).exec();
    const addr = await this.addressModel.findOneAndUpdate({ _id: id, user: userId }, { isDefault: true }, { new: true }).exec();
    if (!addr) throw new NotFoundException('Address not found');
    return addr;
  }
}

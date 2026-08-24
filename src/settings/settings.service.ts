import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreSettings, StoreSettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SettingsService {
  constructor(@InjectModel(StoreSettings.name) private settingsModel: Model<StoreSettingsDocument>) {}

  async getSettings() {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = new this.settingsModel();
      await settings.save();
    }
    return settings;
  }

  async updateSettings(fields: Partial<StoreSettings>) {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = new this.settingsModel(fields);
    } else {
      Object.assign(settings, fields);
    }
    return await settings.save();
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NewsletterSubscriber, NewsletterSubscriberDocument } from './schemas/newsletter.schema';

@Injectable()
export class NewsletterService {
  constructor(@InjectModel(NewsletterSubscriber.name) private newsletterModel: Model<NewsletterSubscriberDocument>) {}

  async subscribe(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.newsletterModel.findOne({ email: cleanEmail }).exec();
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
        return existing;
      }
      throw new BadRequestException('Email is already subscribed to our newsletter!');
    }

    const created = new this.newsletterModel({ email: cleanEmail });
    return await created.save();
  }

  async unsubscribe(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.newsletterModel.findOneAndUpdate({ email: cleanEmail }, { isActive: false }).exec();
    if (!existing) throw new BadRequestException('Email not found');
    return { email: cleanEmail };
  }
}

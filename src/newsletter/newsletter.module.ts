import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterSubscriber, NewsletterSubscriberSchema } from './schemas/newsletter.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: NewsletterSubscriber.name, schema: NewsletterSubscriberSchema }])],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService, MongooseModule],
})
export class NewsletterModule {}

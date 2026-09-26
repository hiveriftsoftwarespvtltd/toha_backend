import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GenderCardsService } from './gender-cards.service';
import { GenderCardsController } from './gender-cards.controller';
import { GenderCard, GenderCardSchema } from './schemas/gender-card.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GenderCard.name, schema: GenderCardSchema },
    ]),
  ],
  controllers: [GenderCardsController],
  providers: [GenderCardsService],
  exports: [GenderCardsService, MongooseModule],
})
export class GenderCardsModule {}

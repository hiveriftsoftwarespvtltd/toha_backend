import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { AddressesModule } from './addresses/addresses.module';
import { OrdersModule } from './orders/orders.module';
import { CouponsModule } from './coupons/coupons.module';
import { ReviewsModule } from './reviews/reviews.module';
import { InventoryModule } from './inventory/inventory.module';
import { BannersModule } from './banners/banners.module';
import { ReturnsModule } from './returns/returns.module';
import { PaymentsModule } from './payments/payments.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGO_URI') ||
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/tohay_kids',
        dbName: configService.get<string>('MONGO_DB') || 'tohay_kids',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    CartModule,
    WishlistModule,
    AddressesModule,
    OrdersModule,
    CouponsModule,
    ReviewsModule,
    InventoryModule,
    BannersModule,
    ReturnsModule,
    PaymentsModule,
    NewsletterModule,
    AnalyticsModule,
    ReportsModule,
    SettingsModule,
    UploadsModule,
  ],
})
export class AppModule { }

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wishlist, WishlistDocument } from './schemas/wishlist.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name) private wishlistModel: Model<WishlistDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async getWishlist(userId: string) {
    let wishlist = await this.wishlistModel.findOne({ user: userId }).exec();
    if (!wishlist) {
      wishlist = new this.wishlistModel({ user: userId, productIds: [] });
      await wishlist.save();
    }

    const products = await this.productModel.find({ id: { $in: wishlist.productIds } }).exec();
    return {
      productIds: wishlist.productIds,
      products,
    };
  }

  async toggleWishlist(userId: string, productId: string) {
    let wishlist = await this.wishlistModel.findOne({ user: userId }).exec();
    if (!wishlist) {
      wishlist = new this.wishlistModel({ user: userId, productIds: [] });
    }

    let action = '';
    if (wishlist.productIds.includes(productId)) {
      wishlist.productIds = wishlist.productIds.filter((id) => id !== productId);
      action = 'removed from';
    } else {
      wishlist.productIds.push(productId);
      action = 'added to';
    }

    await wishlist.save();
    const products = await this.productModel.find({ id: { $in: wishlist.productIds } }).exec();

    return {
      action,
      productIds: wishlist.productIds,
      products,
    };
  }
}

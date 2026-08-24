import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async findProductReviews(productId: string) {
    return await this.reviewModel.find({ productId, status: 'Approved' }).sort({ createdAt: -1 }).exec();
  }

  async findAllAdminReviews() {
    return await this.reviewModel.find().sort({ createdAt: -1 }).exec();
  }

  async createReview(userId: string, customerName: string, data: { productId: string; rating: number; title?: string; comment: string; images?: string[] }) {
    const product = await this.productModel.findOne({ id: data.productId }).exec();
    if (!product) throw new NotFoundException(`Product #${data.productId} not found`);

    const id = `rev-${Date.now()}`;
    const newReview = new this.reviewModel({
      id,
      user: userId,
      productId: product.id,
      productName: product.name,
      customerName,
      rating: data.rating,
      title: data.title || 'Great Quality!',
      comment: data.comment,
      images: data.images || [],
      status: 'Approved',
      isVerifiedPurchase: true,
    });

    const saved = await newReview.save();
    await this.recalculateProductRating(product.id);
    return saved;
  }

  async updateStatus(id: string, status: string) {
    const review = await this.reviewModel.findOneAndUpdate({ id }, { status }, { new: true }).exec();
    if (!review) throw new NotFoundException(`Review #${id} not found`);
    await this.recalculateProductRating(review.productId);
    return review;
  }

  async deleteReview(id: string) {
    const review = await this.reviewModel.findOneAndDelete({ id }).exec();
    if (!review) throw new NotFoundException(`Review #${id} not found`);
    await this.recalculateProductRating(review.productId);
    return { id };
  }

  private async recalculateProductRating(productId: string) {
    const reviews = await this.reviewModel.find({ productId, status: 'Approved' }).exec();
    const count = reviews.length;
    const avg = count > 0 ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)) : 5.0;

    await this.productModel.findOneAndUpdate({ id: productId }, { rating: avg, reviewsCount: count }).exec();
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Coupon, CouponDocument } from '../coupons/schemas/coupon.schema';
import { CouponType } from '../common/enums';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
  ) {}

  async getCart(userId: string) {
    let cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) {
      cart = new this.cartModel({ user: userId, items: [], couponCode: '', discountPercent: 0 });
      await cart.save();
    }

    return await this.calculateCartSummary(cart);
  }

  async addItem(userId: string, itemData: { productId: string; size?: string; qty?: number; child1Size?: string; child2Size?: string }) {
    const product = await this.productModel.findOne({ id: itemData.productId }).exec();
    if (!product) {
      throw new NotFoundException(`Product #${itemData.productId} not found`);
    }

    let cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) {
      cart = new this.cartModel({ user: userId, items: [] });
    }

    const size = itemData.size || (product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Standard');
    const qty = itemData.qty && itemData.qty > 0 ? itemData.qty : 1;

    const existingIndex = cart.items.findIndex((i) => i.productId === itemData.productId && i.size === size);

    if (existingIndex > -1) {
      cart.items[existingIndex].qty += qty;
    } else {
      cart.items.push({
        product: product._id as any,
        productId: product.id,
        size,
        child1Size: itemData.child1Size || null,
        child2Size: itemData.child2Size || null,
        qty,
      });
    }

    await cart.save();
    return await this.calculateCartSummary(cart);
  }

  async updateItemQuantity(userId: string, productId: string, size: string, delta: number) {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) throw new NotFoundException('Cart not found');

    const index = cart.items.findIndex((i) => i.productId === productId && i.size === size);
    if (index > -1) {
      const newQty = cart.items[index].qty + delta;
      if (newQty <= 0) {
        cart.items.splice(index, 1);
      } else {
        cart.items[index].qty = newQty;
      }
      await cart.save();
    }

    return await this.calculateCartSummary(cart);
  }

  async removeItem(userId: string, productId: string, size: string) {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) throw new NotFoundException('Cart not found');

    cart.items = cart.items.filter((i) => !(i.productId === productId && i.size === size));
    await cart.save();

    return await this.calculateCartSummary(cart);
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (cart) {
      cart.items = [];
      cart.couponCode = '';
      cart.discountPercent = 0;
      await cart.save();
    }
    return await this.calculateCartSummary(cart);
  }

  async applyCoupon(userId: string, code: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Please enter a valid coupon code');
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Search in DB coupons collection (case-insensitive)
    const coupon = await this.couponModel.findOne({
      code: new RegExp(`^${cleanCode}$`, 'i'),
      isActive: true,
    }).exec();

    if (coupon) {
      const isFixed = coupon.type === CouponType.FIXED || coupon.type === ('FIXED' as any) || (coupon as any).discountType === 'Fixed Amount';
      const dType = isFixed ? 'FIXED' : 'PERCENTAGE';
      return this.setCartCoupon(userId, coupon.code, dType, coupon.value);
    }

    // 2. Built-in promotional coupon codes
    const builtInCoupons: Record<string, { type: string; value: number }> = {
      TOHAY10: { type: 'PERCENTAGE', value: 10 },
      WELCOME10: { type: 'PERCENTAGE', value: 10 },
      FESTIVE15: { type: 'PERCENTAGE', value: 15 },
      EXTRA5: { type: 'PERCENTAGE', value: 5 },
      TOHAY20: { type: 'PERCENTAGE', value: 20 },
      FIRST10: { type: 'PERCENTAGE', value: 10 },
      SAVE10: { type: 'PERCENTAGE', value: 10 },
      SAVE100: { type: 'FIXED', value: 100 },
      SAIF100: { type: 'FIXED', value: 100 },
    };

    if (builtInCoupons[cleanCode]) {
      const c = builtInCoupons[cleanCode];
      return this.setCartCoupon(userId, cleanCode, c.type, c.value);
    }

    // 3. Fallback for custom entered promo code (10% discount)
    return this.setCartCoupon(userId, cleanCode, 'PERCENTAGE', 10);
  }

  private async setCartCoupon(userId: string, code: string, discountType: string, discountValue: number) {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) throw new NotFoundException('Cart not found');

    cart.couponCode = code;
    cart.discountType = discountType;
    cart.discountValue = discountValue;
    cart.discountPercent = discountType === 'PERCENTAGE' ? discountValue : 0;
    await cart.save();

    return await this.calculateCartSummary(cart);
  }

  async removeCoupon(userId: string) {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (cart) {
      cart.couponCode = '';
      cart.discountType = 'PERCENTAGE';
      cart.discountValue = 0;
      cart.discountPercent = 0;
      await cart.save();
    }
    return await this.calculateCartSummary(cart);
  }

  async calculateCartSummary(cart: CartDocument) {
    const populatedItems = await Promise.all(
      cart.items.map(async (item) => {
        const prod = await this.productModel.findOne({ id: item.productId }).exec();
        return {
          product: prod ? prod.toObject() : null,
          size: item.size,
          child1Size: item.child1Size,
          child2Size: item.child2Size,
          qty: item.qty,
        };
      }),
    );

    const validItems = populatedItems.filter((i) => i.product !== null);

    const subtotal = validItems.reduce((sum, item) => {
      let unitPrice = item.product.price;
      if (Array.isArray(item.product.sizeVariants) && item.product.sizeVariants.length > 0) {
        const matched = item.product.sizeVariants.find((v: any) => v.size === item.size);
        if (matched && matched.price) {
          unitPrice = matched.price;
        }
      }
      return sum + unitPrice * item.qty;
    }, 0);

    const dType = cart.discountType || 'PERCENTAGE';
    const dVal = cart.discountValue || cart.discountPercent || 0;

    let discountAmount = 0;
    if (dType === 'FIXED' || dType === 'Fixed Amount') {
      discountAmount = Math.min(subtotal, dVal);
    } else {
      discountAmount = Math.round((subtotal * dVal) / 100);
    }

    const freeShippingThreshold = 1499;
    const shippingFee = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : 99;
    const total = Math.max(0, subtotal - discountAmount + shippingFee);
    const totalItems = validItems.reduce((sum, item) => sum + item.qty, 0);

    return {
      items: validItems,
      couponCode: cart.couponCode || '',
      discountType: dType,
      discountValue: dVal,
      discountPercent: dType === 'PERCENTAGE' ? dVal : 0,
      subtotal,
      discountAmount,
      shippingFee,
      total,
      totalItems,
      freeShippingThreshold,
    };
  }
}

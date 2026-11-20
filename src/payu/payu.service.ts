import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadGatewayException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  InventoryAdjustment,
  InventoryAdjustmentDocument,
} from '../inventory/schemas/inventory-adjustment.schema';
import { OrderStatus, PaymentStatus, StockAdjustmentType } from '../common/enums';
import { InitiateExpressPayuDto } from './dto/initiate-express-payu.dto';

type PayuEnv = 'test' | 'production';
type PayuHashMode = 'v1' | 'dual';

interface PayuConfig {
  key: string;
  salt: string;
  saltV2: string;
  hashMode: PayuHashMode;
  env: PayuEnv;
  appBaseUrl: string;
  frontendUrl: string;
  paymentUrl: string;
  verifyUrl: string;
  sdkUrl: string;
}

const PAYU_ENDPOINTS: Record<
  PayuEnv,
  { paymentUrl: string; verifyUrl: string; sdkUrl: string }
> = {
  test: {
    paymentUrl: 'https://test.payu.in/_payment',
    verifyUrl: 'https://test.payu.in/merchant/postservice.php?form=2',
    sdkUrl: 'https://jssdk-uat.payu.in/bolt/bolt.min.js',
  },
  production: {
    paymentUrl: 'https://secure.payu.in/_payment',
    verifyUrl: 'https://info.payu.in/merchant/postservice.php?form=2',
    sdkUrl: 'https://jssdk.payu.in/bolt/bolt.min.js',
  },
};

@Injectable()
export class PayuService implements OnModuleInit {
  private readonly logger = new Logger(PayuService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(InventoryAdjustment.name)
    private readonly inventoryModel: Model<InventoryAdjustmentDocument>,
  ) {}

  onModuleInit() {
    const issues = this.findConfigIssues();
    if (issues.length > 0) {
      this.logger.warn(
        JSON.stringify({
          stage: 'startup_check',
          outcome: 'payu_config_incomplete',
          issues,
        }),
      );
    } else {
      const env = (this.configService.get<string>('PAYU_ENV') || 'test').trim().toLowerCase();
      this.logger.log(
        JSON.stringify({
          stage: 'startup_check',
          outcome: 'payu_configured',
          env,
        }),
      );
    }
  }

  getPublicConfig() {
    const issues = this.findConfigIssues();
    const envRaw = (this.configService.get<string>('PAYU_ENV') || 'test').trim().toLowerCase();
    const env: PayuEnv = envRaw === 'production' ? 'production' : 'test';
    return {
      configured: issues.length === 0,
      env,
      sdkUrl: PAYU_ENDPOINTS[env].sdkUrl,
    };
  }

  private findConfigIssues(): string[] {
    const issues: string[] = [];
    const key = (this.configService.get<string>('PAYU_MERCHANT_KEY') || '').trim();
    const salt = (this.configService.get<string>('PAYU_MERCHANT_SALT') || '').trim();
    const envRaw = (this.configService.get<string>('PAYU_ENV') || 'test').trim().toLowerCase();
    const hashModeRaw = (this.configService.get<string>('PAYU_HASH_MODE') || 'v1')
      .trim()
      .toLowerCase();
    const appBaseUrl = (this.configService.get<string>('APP_BASE_URL') || '').trim();

    if (!key) issues.push('Missing PAYU_MERCHANT_KEY');
    if (!salt) issues.push('Missing PAYU_MERCHANT_SALT');
    if (envRaw !== 'test' && envRaw !== 'production') {
      issues.push('Invalid PAYU_ENV (must be "test" or "production")');
    }
    if (hashModeRaw !== 'v1' && hashModeRaw !== 'dual') {
      issues.push('Invalid PAYU_HASH_MODE (must be "v1" or "dual")');
    }
    if (!appBaseUrl) issues.push('Missing APP_BASE_URL');

    return issues;
  }

  private getConfig(): PayuConfig {
    const issues = this.findConfigIssues();
    if (issues.length > 0) {
      this.logger.error(
        JSON.stringify({
          stage: 'config_validation',
          outcome: 'misconfigured',
          issues,
        }),
      );
      throw new InternalServerErrorException('PayU payment provider is not configured properly');
    }

    const key = (this.configService.get<string>('PAYU_MERCHANT_KEY') || '').trim();
    const salt = (this.configService.get<string>('PAYU_MERCHANT_SALT') || '').trim();
    const saltV2 = (this.configService.get<string>('PAYU_MERCHANT_SALT_V2') || '').trim() || salt;
    const env = ((this.configService.get<string>('PAYU_ENV') || 'test').trim().toLowerCase() ===
    'production'
      ? 'production'
      : 'test') as PayuEnv;
    const hashMode = ((this.configService.get<string>('PAYU_HASH_MODE') || 'v1')
      .trim()
      .toLowerCase() === 'dual'
      ? 'dual'
      : 'v1') as PayuHashMode;
    const appBaseUrl = (this.configService.get<string>('APP_BASE_URL') || '')
      .trim()
      .replace(/\/+$/, '');
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173')
      .trim()
      .replace(/\/+$/, '');

    return {
      key,
      salt,
      saltV2,
      hashMode,
      env,
      appBaseUrl,
      frontendUrl,
      ...PAYU_ENDPOINTS[env],
    };
  }

  private resolveSafeReturnOrigin(candidate?: string): string {
    const fallback = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173')
      .trim()
      .replace(/\/+$/, '');

    if (!candidate) return fallback;

    try {
      const parsed = new URL(candidate.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return fallback;
      }
      const normalizedOrigin = parsed.origin.replace(/\/+$/, '');

      // Always allow localhost / 127.0.0.1 for local dev testing
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return normalizedOrigin;
      }

      const allowedEnv = (this.configService.get<string>('ALLOWED_ORIGINS') || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);

      const allowedSet = new Set([
        fallback,
        'https://tohay.in',
        'https://www.tohay.in',
        'https://toha.buxaa.in',
        'http://toha.buxaa.in',
        ...allowedEnv,
      ]);

      return allowedSet.has(normalizedOrigin) ? normalizedOrigin : fallback;
    } catch {
      return fallback;
    }
  }

  getFrontendResultUrl(
    type: 'success' | 'failure',
    orderId?: string | null,
    originOverride?: string,
    reason?: string,
  ): string {
    const baseUrl = this.resolveSafeReturnOrigin(originOverride);
    const path = type === 'success' ? '/order-success' : '/order-failure';
    const query = new URLSearchParams();
    if (orderId) query.set('order_id', orderId);
    if (type === 'failure' && reason) {
      query.set('reason', this.sanitizeText(reason, 120));
    }
    const qs = query.toString();
    return qs ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
  }

  private sha512Hex(input: string): string {
    return crypto.createHash('sha512').update(input, 'utf8').digest('hex').toLowerCase();
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a.toLowerCase(), 'utf8');
    const bufB = Buffer.from(b.toLowerCase(), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private sanitizeText(value: unknown, maxLen = 100): string {
    return String(value || '')
      .replace(/[|<>&"'`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
  }

  private sanitizePhone(value: unknown): string {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
      return digits.slice(-10);
    }
    return digits.slice(0, 15);
  }

  private generateTxnId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `PU_${ts}_${rand}`.slice(0, 25);
  }

  /**
   * Forward request hash per PayU Hosted Checkout docs:
   * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
   */
  generateRequestHash(
    params: {
      key: string;
      txnid: string;
      amount: string;
      productinfo: string;
      firstname: string;
      email: string;
      udf1?: string;
      udf2?: string;
      udf3?: string;
      udf4?: string;
      udf5?: string;
    },
    config: PayuConfig,
  ): string {
    const baseParts = [
      params.key,
      params.txnid,
      params.amount,
      params.productinfo,
      params.firstname,
      params.email,
      params.udf1 || '',
      params.udf2 || '',
      params.udf3 || '',
      params.udf4 || '',
      params.udf5 || '',
      '',
      '',
      '',
      '',
      '',
    ];

    const v1Hash = this.sha512Hex([...baseParts, config.salt].join('|'));
    if (config.hashMode === 'dual') {
      const v2Hash = this.sha512Hex([...baseParts, config.saltV2].join('|'));
      return JSON.stringify({ v1: v1Hash, v2: v2Hash });
    }
    return v1Hash;
  }

  /**
   * Reverse response hash per PayU Hosted Checkout docs:
   * sha512([additionalCharges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  verifyReverseHash(body: Record<string, any>, config: PayuConfig): boolean {
    const receivedHashRaw = String(body?.hash || '').trim();
    if (!receivedHashRaw) return false;

    const status = String(body?.status || '').trim();
    const unmappedstatus = String(body?.unmappedstatus || '').trim();
    const txnid = String(body?.txnid || '').trim();
    const amount = String(body?.amount || '').trim();
    const netAmountDebit = String(body?.net_amount_debit || '').trim();
    const productinfo = String(body?.productinfo || '').trim();
    const firstname = String(body?.firstname || '').trim();
    const lastname = String(body?.lastname || '').trim();
    const email = String(body?.email || '').trim();
    const postedKey = String(body?.key || '').trim();
    const udf1 = String(body?.udf1 || '');
    const udf2 = String(body?.udf2 || '');
    const udf3 = String(body?.udf3 || '');
    const udf4 = String(body?.udf4 || '');
    const udf5 = String(body?.udf5 || '');
    const additionalCharges = String(
      body?.additionalCharges ?? body?.additional_charges ?? '',
    ).trim();
    const splitInfo = String(body?.splitInfo || '').trim();

    if (!status || !txnid) return false;

    let expectedV1 = receivedHashRaw;
    let expectedV2: string | null = null;
    if (receivedHashRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(receivedHashRaw);
        if (typeof parsed?.v1 === 'string') {
          expectedV1 = parsed.v1;
          expectedV2 = typeof parsed?.v2 === 'string' ? parsed.v2 : null;
        }
      } catch {
        return false;
      }
    }

    const matchDigest = (prefixWithoutSalt: string[], suffix: string[]): boolean => {
      const v1Input = [...prefixWithoutSalt, config.salt, ...suffix].join('|');
      const v1Match = this.constantTimeEqual(this.sha512Hex(v1Input), expectedV1);
      if (!expectedV2) return v1Match;

      const v2Input = [...prefixWithoutSalt, config.saltV2, ...suffix].join('|');
      return v1Match && this.constantTimeEqual(this.sha512Hex(v2Input), expectedV2);
    };

    const matchAfterSalt = (
      saltPrefix: string[],
      statusVal: string,
      emptyCount: number,
      includeUdfs: boolean,
      emailVal: string,
      nameVal: string,
      productinfoVal: string,
      amountVal: string,
      txnidVal: string,
      keyVal: string,
      splitVal?: string,
    ): boolean => {
      const empties = Array(emptyCount).fill('');
      const middle = splitVal ? [statusVal, splitVal, ...empties] : [statusVal, ...empties];
      const udfParts = includeUdfs ? [udf5, udf4, udf3, udf2, udf1] : ['', '', '', '', ''];
      const suffix = [
        ...middle,
        ...udfParts,
        emailVal,
        nameVal,
        productinfoVal,
        amountVal,
        txnidVal,
        keyVal,
      ];
      return matchDigest(saltPrefix, suffix);
    };

    // Fast path: standard documented PayU reverse hash formulas
    const documentedChecks: Array<() => boolean> = [
      () => matchAfterSalt([], status, 5, true, email, firstname, productinfo, amount, txnid, config.key),
      () => matchAfterSalt([], status, 5, false, email, firstname, productinfo, amount, txnid, config.key),
    ];

    if (additionalCharges) {
      documentedChecks.push(
        () =>
          matchAfterSalt(
            [additionalCharges],
            status,
            5,
            true,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            config.key,
          ),
        () =>
          matchAfterSalt(
            [additionalCharges],
            status,
            5,
            false,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            config.key,
          ),
      );
    }

    if (splitInfo) {
      documentedChecks.push(
        () =>
          matchAfterSalt(
            [],
            status,
            5,
            true,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            config.key,
            splitInfo,
          ),
        () =>
          matchAfterSalt(
            [],
            status,
            5,
            false,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            config.key,
            splitInfo,
          ),
      );
    }

    for (const check of documentedChecks) {
      if (check()) return true;
    }

    // Secondary compatibility permutations (PayU UAT/Prod quirks)
    const keys = Array.from(new Set([config.key, postedKey].filter(Boolean)));
    const statuses = Array.from(new Set([status, unmappedstatus].filter(Boolean)));
    const names = Array.from(
      new Set(
        [
          firstname,
          lastname ? `${firstname}${lastname}` : '',
          lastname ? `${firstname} ${lastname}` : '',
        ].filter(Boolean),
      ),
    );
    const amounts = Array.from(new Set([amount, netAmountDebit].filter(Boolean)));
    const emptyCounts = [5, 6];
    const prefixes = additionalCharges ? [[], [additionalCharges]] : [[]];
    const splits = splitInfo ? [undefined, splitInfo] : [undefined];

    for (const k of keys) {
      for (const s of statuses) {
        for (const n of names) {
          for (const a of amounts) {
            for (const ec of emptyCounts) {
              for (const pref of prefixes) {
                for (const sp of splits) {
                  if (matchAfterSalt(pref, s, ec, true, email, n, productinfo, a, txnid, k, sp)) {
                    return true;
                  }
                  if (matchAfterSalt(pref, s, ec, false, email, n, productinfo, a, txnid, k, sp)) {
                    return true;
                  }
                }
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * PayU CommercePro 1-Click Express Checkout (bolt.launch + v2Hash).
   * Can create a pending order directly from cart items (no custom checkout form needed)
   * OR re-initiate payment for an existing unpaid order_id.
   */
  async initiateExpressCheckout(userId: string | undefined, dto: InitiateExpressPayuDto) {
    const config = this.getConfig();
    const user = userId ? await this.userModel.findById(userId).exec() : null;

    let order: OrderDocument | null = null;
    const requestedOrderId = String(dto?.order_id || '').trim();

    if (requestedOrderId) {
      order = await this.orderModel.findOne({ id: requestedOrderId }).exec();
      if (!order) {
        throw new NotFoundException(`Order #${requestedOrderId} not found`);
      }
      if (userId && order.user && String(order.user) !== String(userId)) {
        throw new NotFoundException(`Order #${requestedOrderId} not found`);
      }
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException(`Order #${requestedOrderId} is already paid`);
      }
    } else {
      const rawItems = Array.isArray(dto?.items) && dto.items.length > 0 ? dto.items : null;
      const dbCart = !rawItems && userId ? await this.cartModel.findOne({ user: userId }).exec() : null;
      const itemsToProcess = rawItems || (dbCart ? dbCart.items : []);

      if (!itemsToProcess || itemsToProcess.length === 0) {
        throw new BadRequestException('Cart is empty. Please add items before checking out.');
      }

      const orderItems: any[] = [];
      let subtotal = 0;

      for (const item of itemsToProcess) {
        const pId = item.productId || item.product?.id || item.product?._id || item.id;
        let product = pId ? await this.productModel.findOne({ id: pId }).exec() : null;
        if (!product && pId) {
          try {
            product = await this.productModel.findById(pId).exec();
          } catch (_) {}
        }

        const itemQty = Math.max(1, Number(item.qty) || 1);
        let itemPrice = product
          ? product.price
          : Number(item.price) || Number(item.product?.price) || 0;

        let matchedVariant: any = null;
        if (product && Array.isArray(product.sizeVariants) && product.sizeVariants.length > 0) {
          matchedVariant = product.sizeVariants.find((v) => v.size === item.size);
          if (matchedVariant && matchedVariant.price) {
            itemPrice = matchedVariant.price;
          }
        }

        if (product) {
          if (matchedVariant && (matchedVariant.isAvailable === false || matchedVariant.stock < itemQty)) {
            throw new BadRequestException(`Sorry, size "${item.size}" of "${product.name}" is out of stock.`);
          }
          if (product.stock < itemQty) {
            throw new BadRequestException(
              `Sorry, "${product.name}" is currently out of stock (Available: ${product.stock} units).`,
            );
          }
        }

        const itemName = product ? product.name : item.name || item.product?.name || 'Festive Outfit';
        const itemImage =
          product && product.images && product.images.length > 0
            ? product.images[0]
            : item.image || item.product?.images?.[0] || item.product?.image || '';

        subtotal += itemPrice * itemQty;

        orderItems.push({
          productId: product?.id || pId || 'P1001',
          name: itemName,
          price: itemPrice,
          qty: itemQty,
          size: item.size || 'Standard',
          image: itemImage,
        });
      }

      const discount = Math.max(0, Number(dto?.discount) || 0);
      const freeShippingThreshold = 1499;
      const shipping =
        dto?.shipping !== undefined && dto?.shipping !== null
          ? Number(dto.shipping)
          : subtotal >= freeShippingThreshold
            ? 0
            : 99;
      const tax = Number(dto?.tax) || Math.round(Math.max(0, subtotal - discount) * 0.05);
      const totalAmount = Math.max(1, subtotal - discount + shipping);

      const orderId = `TK${Math.floor(10000 + Math.random() * 90000)}`;
      const customerName = dto?.shippingAddress?.name || user?.name || 'Customer';
      const customerEmail = dto?.shippingAddress?.email || user?.email || 'customer@tohay.in';
      const customerPhone = this.sanitizePhone(dto?.shippingAddress?.phone || user?.phone || '');

      const nowStr = new Date().toLocaleString();
      order = await new this.orderModel({
        id: orderId,
        user: user ? user._id : null,
        customerName,
        customerEmail,
        customerPhone,
        items: orderItems,
        itemsCount: orderItems.reduce((acc, i) => acc + i.qty, 0),
        subtotal,
        discount,
        shipping,
        tax,
        totalAmount,
        paymentMethod: 'PayU CommercePro',
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PENDING,
        stockDeducted: false,
        shippingAddress: {
          flat: dto?.shippingAddress?.flat || '',
          street: dto?.shippingAddress?.street || '',
          city: dto?.shippingAddress?.city || '',
          state: dto?.shippingAddress?.state || '',
          pincode: dto?.shippingAddress?.pincode || '',
        },
        timeline: [
          {
            status: 'Placed',
            date: nowStr,
            completed: true,
            note: 'Order created — awaiting PayU CommercePro Checkout',
          },
          { status: 'Confirmed', date: 'Pending', completed: false, note: 'Awaiting payment verification' },
          { status: 'Processing', date: 'Pending', completed: false, note: 'Packing begins after payment' },
          { status: 'Shipped', date: 'Pending', completed: false, note: 'Awaiting courier dispatch' },
          { status: 'Delivered', date: 'Pending', completed: false, note: 'Estimated delivery in 2-3 days' },
        ],
        courier: {
          name: 'BlueDart Express',
          trackingNumber: `AWB${Math.floor(100000 + Math.random() * 900000)}`,
        },
      }).save();
    }

    const numericAmount = Number(order.totalAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Order amount must be a positive number');
    }

    const amountStr = numericAmount.toFixed(2);
    const txnid = this.generateTxnId();
    const productinfo = this.sanitizeText(`Tohay Kids Order ${order.id}`, 100);
    const firstname = this.sanitizeText(
      (order.customerName || '').trim().split(/\s+/)[0] || order.customerName || 'Customer',
      60,
    );
    const email = String(order.customerEmail || '').trim();
    const phone = this.sanitizePhone(order.customerPhone || '');
    const safeOrigin = this.resolveSafeReturnOrigin(dto?.return_origin);

    order.payuTxnId = txnid;
    order.payuTxnHistory = Array.isArray(order.payuTxnHistory)
      ? Array.from(new Set([...order.payuTxnHistory, txnid]))
      : [txnid];
    order.paymentMethod = 'PayU CommercePro';
    order.paymentStatus = PaymentStatus.PENDING;
    order.returnOrigin = safeOrigin;
    await order.save();

    const skuDetails: Array<Record<string, any>> = (order.items || []).map((item) => {
      const entry: Record<string, any> = {
        sku_id: String(item.productId || 'TK1001'),
        sku_name: this.sanitizeText(`${item.name} (${item.size || 'Std'})`, 80),
        amount_per_sku: Number(item.price || 0).toFixed(2),
        quantity: String(item.qty || 1),
      };
      const img = String(item.image || '').trim();
      if (img.startsWith('https://') && !img.includes('localhost') && !img.includes('127.0.0.1')) {
        entry.logo = img;
      }
      return entry;
    });

    // Add shipping fee as a transparent SKU line item so sum(sku_details) matches totalAmount exactly
    const shippingAmt = Math.max(0, Number(order.shipping) || 0);
    if (shippingAmt > 0) {
      skuDetails.push({
        sku_id: 'SHIPPING',
        sku_name: 'Express Shipping & Delivery',
        amount_per_sku: shippingAmt.toFixed(2),
        quantity: '1',
      });
    }

    const itemsSum = skuDetails.reduce(
      (sum, item) => sum + (Number(item.amount_per_sku) || 0) * (Number(item.quantity) || 1),
      0,
    );

    const discountAmt = Math.max(0, Number(order.discount) || 0);
    const cartAmountStr = itemsSum > 0 ? itemsSum.toFixed(2) : amountStr;

    const cartDetails: Record<string, any> = {
      amount: cartAmountStr,
      items: skuDetails.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
      sku_details: skuDetails,
    };

    if (discountAmt > 0) {
      cartDetails.pre_discount = discountAmt.toFixed(2);
    }

    const addr = order.shippingAddress || ({} as any);
    const flat = this.sanitizeText(addr.flat || '', 100);
    const street = this.sanitizeText(addr.street || '', 100);
    const city = this.sanitizeText(addr.city || '', 50);
    const state = this.sanitizeText(addr.state || '', 50);
    const zipcode = this.sanitizeText(addr.pincode || '', 20);

    const expressData: Record<string, any> = {
      key: config.key,
      txnid,
      amount: amountStr,
      phone: phone.length >= 10 ? phone : '',
      firstname,
      lastname: '',
      email,
      ...(flat ? { address1: flat } : {}),
      ...(street ? { address2: street } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      country: 'India',
      ...(zipcode ? { zipcode } : {}),
      udf1: order.id,
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
      isCheckoutExpress: true,
      icp_source: 'express',
      productinfo,
      surl: `${config.appBaseUrl}/api/payu/success`,
      furl: `${config.appBaseUrl}/api/payu/failure`,
      orderid: order.id,
      editPhoneAllowed: true,
      editEmailAllowed: true,
      cart_details: cartDetails,
    };

    const date = new Date().toUTCString();
    // v2Hash: data must remain as JSON STRING for HMAC to match PayU's server verification
    const stringifiedData = JSON.stringify(expressData);
    const signature = this.sha512Hex(`${stringifiedData}|${date}|${config.salt}`);
    const v2Hash = `hmac username="${config.key}", algorithm="sha512", headers="date", signature="${signature}"`;

    this.logger.log(
      JSON.stringify({
        stage: 'express_initiate',
        orderId: order.id,
        txnid,
        env: config.env,
        outcome: 'initiated',
      }),
    );

    let merchantDomain = (this.configService.get<string>('PAYU_MERCHANT_DOMAIN') || '').trim();
    if (!merchantDomain) {
      try {
        merchantDomain = new URL(config.frontendUrl).hostname;
      } catch {
        merchantDomain = 'tohay.in';
      }
    }

    return {
      env: config.env,
      sdkUrl: config.sdkUrl,
      merchantDomain,
      orderId: order.id,
      txnid,
      // data must be JSON STRING — bolt.launch does JSON.parse(data) internally
      // HMAC is signed on this exact string, so must not be re-serialized
      data: stringifiedData,
      date,
      isCheckoutExpress: true,
      v2Hash,
    };
  }

  /**
   * Persists shipping address collected inside PayU CommercePro Checkout onto the Order document.
   */
  private applyShippingAddressFromPayu(order: OrderDocument, body: Record<string, any>) {
    let addr: any = body?.shipping_address ?? body?.shippingAddress ?? null;
    if (typeof addr === 'string' && addr.trim()) {
      try {
        addr = JSON.parse(addr);
      } catch {
        addr = null;
      }
    }

    if (addr && typeof addr === 'object') {
      const name = String(addr.name || '').trim();
      const email = String(addr.email || '').trim();
      const phone = this.sanitizePhone(addr.addressPhoneNumber || addr.phone || body?.phone || '');
      const flat = String(addr.addressLine || addr.address1 || addr.flat || '').trim();
      const street = String(addr.landmark || addr.address2 || addr.street || '').trim();
      const city = String(addr.city || '').trim();
      const state = String(addr.state || '').trim();
      const pincode = String(addr.zipCode || addr.zipcode || addr.pincode || '').trim();

      if (name) order.customerName = name;
      if (email) order.customerEmail = email;
      if (phone) order.customerPhone = phone;

      order.shippingAddress = {
        flat: flat || order.shippingAddress?.flat || '',
        street: street || order.shippingAddress?.street || '',
        city: city || order.shippingAddress?.city || '',
        state: state || order.shippingAddress?.state || '',
        pincode: pincode || order.shippingAddress?.pincode || '',
      };
      return;
    }

    // Also capture flat top-level address fields if sent in PayU callback
    if (body?.address1 || body?.city || body?.zipcode) {
      order.shippingAddress = {
        flat: String(body.address1 || order.shippingAddress?.flat || '').trim(),
        street: String(body.address2 || order.shippingAddress?.street || '').trim(),
        city: String(body.city || order.shippingAddress?.city || '').trim(),
        state: String(body.state || order.shippingAddress?.state || '').trim(),
        pincode: String(body.zipcode || order.shippingAddress?.pincode || '').trim(),
      };
    }
  }

  /**
   * Handles client-side bolt.launch responseHandler payload for PayU CommercePro.
   * Never trusts client status alone: verifies reverse hash or PayU verify_payment API.
   */
  async completeExpressCheckout(body: Record<string, any>, userId?: string) {
    const config = this.getConfig();
    const payload = (body?.response && typeof body.response === 'object' ? body.response : body) || {};
    const txnid = String(payload?.txnid || body?.txnid || '').trim();
    const udf1 = String(payload?.udf1 || body?.order_id || body?.orderId || '').trim();
    const txnStatusRaw = String(payload?.txnStatus || payload?.status || '')
      .trim()
      .toLowerCase();
    const mihpayid = String(payload?.mihpayid || '').trim();
    const mode = String(payload?.mode || '').trim();

    let order: OrderDocument | null = null;
    if (txnid) {
      order = await this.orderModel
        .findOne({ $or: [{ payuTxnId: txnid }, { payuTxnHistory: txnid }] })
        .exec();
    }
    if (!order && udf1) {
      order = await this.orderModel.findOne({ id: udf1 }).exec();
    }

    if (!order) {
      throw new NotFoundException('Order not found for PayU CommercePro completion');
    }

    if (userId && order.user && String(order.user) !== String(userId)) {
      throw new NotFoundException('Order not found for PayU CommercePro completion');
    }

    this.applyShippingAddressFromPayu(order, payload);
    await order.save();

    if (txnStatusRaw === 'cancel' || txnStatusRaw === 'cancelled') {
      return {
        order_id: order.id,
        txnid: txnid || order.payuTxnId,
        status: 'cancelled',
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
      };
    }

    const hashValid =
      Boolean(payload?.hash) &&
      Boolean(payload?.status) &&
      Boolean(txnid) &&
      this.verifyReverseHash(payload, config);

    if (hashValid) {
      const statusLower = String(payload.status).trim().toLowerCase();
      if (statusLower === 'success') {
        await this.markOrderPaidIdempotent(order, txnid, mihpayid, mode);
        return {
          order_id: order.id,
          txnid,
          status: 'paid',
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          totalAmount: order.totalAmount,
          mihpayid: order.payuMihpayId || mihpayid,
          mode: order.payuMode || mode,
        };
      }
      if (statusLower === 'failure' || statusLower === 'failed') {
        await this.markOrderFailedIdempotent(order, txnid, mihpayid, mode);
        return {
          order_id: order.id,
          txnid,
          status: 'failed',
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          totalAmount: order.totalAmount,
        };
      }
    }

    // Fallback to server-to-server PayU verify_payment API
    return this.verifyOrderPayment(order.id, userId);
  }

  /**
   * Step 1 (Classic Hosted Checkout): Prepare signed PayU Hosted Checkout form payload for an existing order.
   */
  async initiatePayment(orderId: string, userId?: string, returnOrigin?: string) {
    const config = this.getConfig();
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanOrderId) {
      throw new BadRequestException('order_id is required');
    }

    const order = await this.orderModel.findOne({ id: cleanOrderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order #${cleanOrderId} not found`);
    }

    if (userId && order.user && String(order.user) !== String(userId)) {
      throw new NotFoundException(`Order #${cleanOrderId} not found`);
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException(`Order #${cleanOrderId} is already paid`);
    }

    const numericAmount = Number(order.totalAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Order amount must be a positive number');
    }

    const amountStr = numericAmount.toFixed(2);
    const firstname = this.sanitizeText(
      (order.customerName || '').trim().split(/\s+/)[0] || order.customerName || '',
      60,
    );
    const email = String(order.customerEmail || '').trim();
    const phone = this.sanitizePhone(order.customerPhone || '');

    if (!firstname) {
      throw new BadRequestException('Customer firstname is required for PayU payment');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Customer email is required for PayU payment');
    }
    if (!phone || phone.length < 10) {
      throw new BadRequestException('Customer 10-digit phone is required for PayU payment');
    }

    const txnid = this.generateTxnId();
    const productinfo = this.sanitizeText(`Tohay Kids Order ${order.id}`, 100);
    const udf1 = order.id;
    const udf2 = '';
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';

    const hash = this.generateRequestHash(
      {
        key: config.key,
        txnid,
        amount: amountStr,
        productinfo,
        firstname,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
      },
      config,
    );

    const safeOrigin = this.resolveSafeReturnOrigin(returnOrigin);

    order.payuTxnId = txnid;
    order.payuTxnHistory = Array.isArray(order.payuTxnHistory)
      ? Array.from(new Set([...order.payuTxnHistory, txnid]))
      : [txnid];
    order.paymentMethod = 'PayU Online';
    order.paymentStatus = PaymentStatus.PENDING;
    order.returnOrigin = safeOrigin;
    await order.save();

    const params: Record<string, string> = {
      key: config.key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      phone,
      surl: `${config.appBaseUrl}/api/payu/success`,
      furl: `${config.appBaseUrl}/api/payu/failure`,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      hash,
      address1: this.sanitizeText(order.shippingAddress?.flat || '', 100),
      address2: this.sanitizeText(order.shippingAddress?.street || '', 100),
      city: this.sanitizeText(order.shippingAddress?.city || '', 50),
      state: this.sanitizeText(order.shippingAddress?.state || '', 50),
      zipcode: this.sanitizeText(order.shippingAddress?.pincode || '', 20),
      country: 'India',
    };

    this.logger.log(
      JSON.stringify({
        stage: 'initiate',
        orderId: order.id,
        txnid,
        env: config.env,
        status: 'pending',
        outcome: 'initiated',
      }),
    );

    return {
      action: config.paymentUrl,
      params,
      orderId: order.id,
      txnid,
      env: config.env,
    };
  }

  /**
   * Step 2: Handle PayU sURL / fURL POST callback (and S2S webhook).
   */
  async handleCallback(body: Record<string, any>) {
    const config = this.getConfig();
    const txnid = String(body?.txnid || '').trim();
    const postedStatus = String(body?.status || '').trim().toLowerCase();
    const postedHash = String(body?.hash || '').trim();
    const udf1 = String(body?.udf1 || '').trim();
    const mihpayid = String(body?.mihpayid || '').trim();
    const mode = String(body?.mode || '').trim();
    const errorReason = String(
      body?.error_Message || body?.field9 || body?.error || '',
    ).trim();

    let order: OrderDocument | null = null;
    if (txnid) {
      order = await this.orderModel
        .findOne({ $or: [{ payuTxnId: txnid }, { payuTxnHistory: txnid }] })
        .exec();
    }
    if (!order && udf1) {
      order = await this.orderModel.findOne({ id: udf1 }).exec();
    }

    const origin = order?.returnOrigin || undefined;

    this.logger.log(
      JSON.stringify({
        stage: 'callback_received',
        orderId: order?.id || udf1 || null,
        txnid: txnid || null,
        status: postedStatus || 'missing',
        outcome: order ? 'order_found' : 'order_not_found',
      }),
    );

    const missingRequired = !postedHash || !postedStatus || !txnid;
    const hashValid = !missingRequired && this.verifyReverseHash(body, config);

    if (!hashValid) {
      this.logger.warn(
        JSON.stringify({
          stage: 'callback_hash_check',
          orderId: order?.id || null,
          txnid: txnid || null,
          status: postedStatus || 'missing',
          outcome: missingRequired ? 'missing_fields' : 'hash_mismatch',
        }),
      );

      // Fallback to server-to-server PayU verify_payment API before giving up
      if (order && order.payuTxnId) {
        try {
          const verified = await this.verifyOrderPayment(order.id);
          return {
            redirectUrl: this.getFrontendResultUrl(
              verified.status === 'paid' ? 'success' : 'failure',
              order.id,
              origin,
              verified.status === 'paid' ? undefined : errorReason || 'Payment could not be verified',
            ),
            orderId: order.id,
            status: verified.status,
          };
        } catch {
          return {
            redirectUrl: this.getFrontendResultUrl(
              'failure',
              order.id,
              origin,
              errorReason || 'Payment verification pending',
            ),
            orderId: order.id,
            status: this.mapOrderPaymentStatus(order.paymentStatus),
          };
        }
      }

      return {
        redirectUrl: this.getFrontendResultUrl(
          'failure',
          order?.id || null,
          origin,
          errorReason || 'Invalid payment response',
        ),
        orderId: order?.id || null,
        status: 'failed',
      };
    }

    if (!order) {
      return {
        redirectUrl: this.getFrontendResultUrl('failure', null, origin, 'Order not found'),
        orderId: null,
        status: 'failed',
      };
    }

    const txnidMatchesOrder =
      order.payuTxnId === txnid ||
      (Array.isArray(order.payuTxnHistory) && order.payuTxnHistory.includes(txnid));

    if (!txnidMatchesOrder) {
      this.logger.warn(
        JSON.stringify({
          stage: 'callback_validation',
          orderId: order.id,
          txnid,
          status: postedStatus,
          outcome: 'txnid_mismatch',
        }),
      );
      return {
        redirectUrl: this.getFrontendResultUrl(
          'failure',
          order.id,
          origin,
          'Transaction ID mismatch',
        ),
        orderId: order.id,
        status: this.mapOrderPaymentStatus(order.paymentStatus),
      };
    }

    const returnedAmount = Number(body?.amount);
    const expectedAmount = Number(order.totalAmount);
    if (
      !Number.isFinite(returnedAmount) ||
      returnedAmount.toFixed(2) !== expectedAmount.toFixed(2)
    ) {
      this.logger.warn(
        JSON.stringify({
          stage: 'callback_validation',
          orderId: order.id,
          txnid,
          status: postedStatus,
          outcome: 'amount_mismatch',
        }),
      );
      return {
        redirectUrl: this.getFrontendResultUrl(
          'failure',
          order.id,
          origin,
          'Payment amount mismatch',
        ),
        orderId: order.id,
        status: this.mapOrderPaymentStatus(order.paymentStatus),
      };
    }

    // Idempotency guard: never downgrade an already paid order
    if (order.paymentStatus === PaymentStatus.PAID) {
      return {
        redirectUrl: this.getFrontendResultUrl('success', order.id, origin),
        orderId: order.id,
        status: 'paid',
      };
    }

    if (postedStatus === 'success') {
      this.applyShippingAddressFromPayu(order, body);
      await this.markOrderPaidIdempotent(order, txnid, mihpayid, mode);
      return {
        redirectUrl: this.getFrontendResultUrl('success', order.id, origin),
        orderId: order.id,
        status: 'paid',
      };
    }

    if (postedStatus === 'failure' || postedStatus === 'failed') {
      await this.markOrderFailedIdempotent(order, txnid, mihpayid, mode);
      return {
        redirectUrl: this.getFrontendResultUrl(
          'failure',
          order.id,
          origin,
          errorReason || 'Payment failed or cancelled',
        ),
        orderId: order.id,
        status: 'failed',
      };
    }

    return {
      redirectUrl: this.getFrontendResultUrl(
        'failure',
        order.id,
        origin,
        errorReason || 'Payment is still pending confirmation',
      ),
      orderId: order.id,
      status: 'pending',
    };
  }

  /**
   * Step 3: Server-to-Server transaction reconciliation via PayU verify_payment API.
   */
  async verifyOrderPayment(orderId: string, userId?: string) {
    const config = this.getConfig();
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanOrderId) {
      throw new BadRequestException('order_id is required');
    }

    const order = await this.orderModel.findOne({ id: cleanOrderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order #${cleanOrderId} not found`);
    }

    if (userId && order.user && String(order.user) !== String(userId)) {
      throw new NotFoundException(`Order #${cleanOrderId} not found`);
    }

    const txnid = (order.payuTxnId || '').trim();
    if (!txnid) {
      throw new BadRequestException(`No PayU transaction initiated for order #${cleanOrderId}`);
    }

    const buildSummary = (status: 'paid' | 'failed' | 'pending') => ({
      order_id: order.id,
      txnid,
      status,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      mihpayid: order.payuMihpayId || '',
      mode: order.payuMode || '',
      itemsCount: order.itemsCount,
      customerPhone: order.customerPhone || '',
    });

    if (order.paymentStatus === PaymentStatus.PAID) {
      return buildSummary('paid');
    }

    const command = 'verify_payment';
    const verifyHash = this.sha512Hex(`${config.key}|${command}|${txnid}|${config.salt}`);
    const formBody = new URLSearchParams({
      key: config.key,
      command,
      var1: txnid,
      hash: verifyHash,
    }).toString();

    const responseJson = await this.callVerifyApiWithRetry(
      config.verifyUrl,
      formBody,
      order.id,
      txnid,
    );

    const txnDetails = responseJson?.transaction_details;
    if (!txnDetails || typeof txnDetails !== 'object') {
      throw new BadGatewayException('PayU verify API returned unexpected response shape');
    }

    const entry = txnDetails[txnid];
    if (!entry || typeof entry !== 'object') {
      return buildSummary(this.mapOrderPaymentStatus(order.paymentStatus));
    }

    const remoteStatus = String(entry.status || '').trim().toLowerCase();
    const errorMsg = String(entry.error_Message || entry.error_message || '')
      .trim()
      .toLowerCase();

    if (remoteStatus === 'not found' || errorMsg.includes('not found')) {
      return buildSummary(this.mapOrderPaymentStatus(order.paymentStatus));
    }

    const rawAmt = entry.amt ?? entry.amount ?? entry.transaction_amount;
    if (rawAmt !== undefined && rawAmt !== null && String(rawAmt).trim() !== '') {
      const verifiedAmt = Number(rawAmt);
      const expectedAmt = Number(order.totalAmount);
      if (!Number.isFinite(verifiedAmt) || verifiedAmt.toFixed(2) !== expectedAmt.toFixed(2)) {
        this.logger.warn(
          JSON.stringify({
            stage: 'verify_api',
            orderId: order.id,
            txnid,
            status: remoteStatus,
            outcome: 'amount_mismatch',
          }),
        );
        throw new BadGatewayException('PayU verified transaction amount mismatch');
      }
    }

    const mihpayid = String(entry.mihpayid || '').trim();
    const mode = String(entry.mode || '').trim();

    if (remoteStatus === 'success') {
      await this.markOrderPaidIdempotent(order, txnid, mihpayid, mode);
      return buildSummary('paid');
    }

    if (remoteStatus === 'failure' || remoteStatus === 'failed') {
      await this.markOrderFailedIdempotent(order, txnid, mihpayid, mode);
      return buildSummary('failed');
    }

    return buildSummary('pending');
  }

  private async callVerifyApiWithRetry(
    verifyUrl: string,
    formBody: string,
    orderId: string,
    txnid: string,
  ): Promise<any> {
    const maxRetries = 2;
    const timeoutMs = 8000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(verifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: formBody,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status >= 400 && res.status < 500) {
          throw new BadGatewayException('PayU verify API rejected request');
        }

        if (res.status >= 500) {
          if (attempt < maxRetries) {
            await this.sleep(300 * Math.pow(2, attempt));
            continue;
          }
          throw new ServiceUnavailableException('PayU verify API temporarily unavailable');
        }

        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new BadGatewayException('PayU verify API returned non-JSON response');
        }
      } catch (err) {
        clearTimeout(timer);
        if (
          err instanceof BadGatewayException ||
          err instanceof ServiceUnavailableException
        ) {
          throw err;
        }
        if (attempt < maxRetries) {
          await this.sleep(300 * Math.pow(2, attempt));
          continue;
        }
        this.logger.error(
          JSON.stringify({
            stage: 'verify_api',
            orderId,
            txnid,
            status: 'network_error',
            outcome: 'retries_exhausted',
          }),
        );
        throw new ServiceUnavailableException('PayU verify API request timed out or failed');
      }
    }

    throw new ServiceUnavailableException('PayU verify API temporarily unavailable');
  }

  private async markOrderPaidIdempotent(
    order: OrderDocument,
    txnid: string,
    mihpayid: string,
    mode: string,
  ) {
    if (order.paymentStatus === PaymentStatus.PAID) return;

    order.paymentStatus = PaymentStatus.PAID;
    order.orderStatus = OrderStatus.PROCESSING;
    order.paymentMethod = mode ? `PayU Online (${mode})` : 'PayU Online';
    order.payuTxnId = txnid;
    if (mihpayid) order.payuMihpayId = mihpayid;
    if (mode) order.payuMode = mode;

    const nowStr = new Date().toLocaleString();
    order.timeline = [
      { status: 'Placed', date: nowStr, completed: true, note: 'Order placed successfully' },
      {
        status: 'Confirmed',
        date: nowStr,
        completed: true,
        note: `PayU payment verified${mihpayid ? ` (Ref: ${mihpayid})` : ''}`,
      },
      { status: 'Processing', date: nowStr, completed: true, note: 'Packing at warehouse' },
      { status: 'Shipped', date: 'Pending', completed: false, note: 'Awaiting courier dispatch' },
      { status: 'Delivered', date: 'Pending', completed: false, note: 'Estimated delivery in 2-3 days' },
    ];

    if (!order.stockDeducted) {
      for (const item of order.items || []) {
        const product = await this.productModel.findOne({ id: item.productId }).exec();
        if (!product) continue;

        const qty = Number(item.qty) || 1;
        if (Array.isArray(product.sizeVariants) && product.sizeVariants.length > 0) {
          const variant = product.sizeVariants.find((v) => v.size === item.size);
          if (variant) {
            variant.stock = Math.max(0, variant.stock - qty);
          }
        }

        const prevStock = product.stock;
        const newStock = Math.max(0, prevStock - qty);
        product.stock = newStock;
        await product.save();

        await new this.inventoryModel({
          productId: product.id,
          productName: product.name,
          previousStock: prevStock,
          adjustment: -qty,
          newStock,
          type: StockAdjustmentType.SALE,
          reason: `PayU Verified Order (${order.id} / ${item.size || 'Default'})`,
        }).save();
      }
      order.stockDeducted = true;
    }

    await order.save();

    if (order.user) {
      await this.cartModel
        .findOneAndUpdate({ user: order.user }, { items: [], discountPercent: 0 })
        .exec();
    }

    const gatewayRef = mihpayid || txnid;
    const existingPayment = await this.paymentModel
      .findOne({ orderId: order.id, gatewayTxnId: gatewayRef, status: PaymentStatus.PAID })
      .exec();

    if (!existingPayment) {
      await this.paymentModel
        .findOneAndUpdate(
          { txnId: txnid },
          {
            txnId: txnid,
            orderId: order.id,
            customerName: order.customerName,
            amount: order.totalAmount,
            method: mode ? `PayU Online (${mode})` : 'PayU Online',
            status: PaymentStatus.PAID,
            gatewayTxnId: gatewayRef,
          },
          { upsert: true, new: true },
        )
        .exec();
    }

    this.logger.log(
      JSON.stringify({
        stage: 'order_updated',
        orderId: order.id,
        txnid,
        mihpayid,
        status: 'paid',
        outcome: 'marked_paid',
      }),
    );
  }

  private async markOrderFailedIdempotent(
    order: OrderDocument,
    txnid: string,
    mihpayid: string,
    mode: string,
  ) {
    if (order.paymentStatus === PaymentStatus.PAID) return;

    order.paymentStatus = PaymentStatus.FAILED;
    if (mihpayid) order.payuMihpayId = mihpayid;
    if (mode) order.payuMode = mode;
    await order.save();

    const existingFailed = await this.paymentModel.findOne({ txnId: txnid }).exec();
    if (!existingFailed) {
      await new this.paymentModel({
        txnId: txnid,
        orderId: order.id,
        customerName: order.customerName,
        amount: order.totalAmount,
        method: mode ? `PayU Online (${mode})` : 'PayU Online',
        status: PaymentStatus.FAILED,
        gatewayTxnId: mihpayid || txnid,
      }).save();
    }

    this.logger.log(
      JSON.stringify({
        stage: 'order_updated',
        orderId: order.id,
        txnid,
        status: 'failed',
        outcome: 'marked_failed',
      }),
    );
  }

  private mapOrderPaymentStatus(status: PaymentStatus): 'paid' | 'failed' | 'pending' {
    if (status === PaymentStatus.PAID) return 'paid';
    if (status === PaymentStatus.FAILED) return 'failed';
    return 'pending';
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

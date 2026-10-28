import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { InventoryAdjustment, InventoryAdjustmentDocument } from '../inventory/schemas/inventory-adjustment.schema';
import { OrderStatus, PaymentStatus, StockAdjustmentType } from '../common/enums';
import {
  ConnectorRequest,
  ConnectorResponse,
  Quote,
  QuoteRequest,
  PrepareRequest,
  CompleteRequest,
  BoundOrder,
} from './interfaces/indisell.interfaces';

@Injectable()
export class IndiSellService {
  private readonly logger = new Logger(IndiSellService.name);
  private readonly merchantKey: string;
  private readonly connectorSecret: string;
  private readonly checkoutOrigin: string;
  private readonly storefrontOrigin: string;

  // In-memory caching for lightning fast idempotency and session lookup
  private readonly memoryIdempotency = new Map<string, { payloadHash: string; response: any }>();
  private readonly memorySessions = new Map<string, { customerId: string; cartId: string; cartVersion: string; checkoutSessionId: string; status: string; orderId?: string }>();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(InventoryAdjustment.name)
    private readonly inventoryModel: Model<InventoryAdjustmentDocument>,
  ) {
    this.merchantKey = this.configService.get<string>('INDISELL_MERCHANT_KEY') || 'mk_tohay_kids';
    this.connectorSecret =
      this.configService.get<string>('INDISELL_CONNECTOR_SECRET') ||
      'c70e5639b61bc9697652242139e76dd8fb498e10';
    this.checkoutOrigin =
      this.configService.get<string>('INDISELL_CHECKOUT_ORIGIN') || 'https://checkout.indisell.com';
    this.storefrontOrigin =
      this.configService.get<string>('INDISELL_STOREFRONT_ORIGIN') || 'https://tohay.in';
  }

  // =========================================================================
  // 1. SIGNATURE VERIFICATION
  // =========================================================================
  verifyConnectorSignature(rawBody: string, headers: Record<string, any>) {
    const key = headers['x-indisell-merchant-key'];
    const timestamp = headers['x-indisell-timestamp'] || '';
    const signature = headers['x-indisell-signature'] || '';

    if (key !== this.merchantKey) {
      this.logger.warn(`Invalid merchant key: received "${key}", expected "${this.merchantKey}"`);
      throw new UnauthorizedException('invalid_authentication');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const tsNum = Number(timestamp);
    if (!/^\d{10}$/.test(String(timestamp)) || Math.abs(nowSec - tsNum) > 300) {
      this.logger.warn(`Timestamp outside valid window: ${timestamp}`);
      throw new UnauthorizedException('invalid_authentication');
    }

    if (!/^[a-f0-9]{64}$/.test(signature)) {
      throw new UnauthorizedException('invalid_authentication');
    }

    const payloadToSign = `custom-connector-v1.${key}.${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', this.connectorSecret)
      .update(payloadToSign)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
      this.logger.warn(`Signature mismatch for raw body size ${rawBody.length}`);
      throw new UnauthorizedException('invalid_authentication');
    }
  }

  // =========================================================================
  // 2. IDEMPOTENCY HANDLER
  // =========================================================================
  async withIdempotency<T>(
    action: string,
    requestId: string,
    rawBody: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const key = `${this.merchantKey}:${action}:${requestId}`;

    // 1. Check in-memory first
    const cached = this.memoryIdempotency.get(key);
    if (cached) {
      if (cached.payloadHash !== payloadHash) {
        throw new ConflictException('operation_conflict');
      }
      return cached.response as T;
    }

    // 2. Check in payments collection
    try {
      const existing = await this.paymentModel.findOne({ txnId: `idem_${key}` }).exec();
      if (existing) {
        if (existing.gatewayTxnId !== payloadHash) {
          throw new ConflictException('operation_conflict');
        }
        const resp = JSON.parse(existing.customerName);
        this.memoryIdempotency.set(key, { payloadHash, response: resp });
        return resp as T;
      }
    } catch (err) { }

    const result = await operation();

    this.memoryIdempotency.set(key, { payloadHash, response: result });

    try {
      await this.paymentModel.findOneAndUpdate(
        { txnId: `idem_${key}` },
        {
          txnId: `idem_${key}`,
          orderId: requestId,
          customerName: JSON.stringify(result).slice(0, 500),
          amount: 0,
          method: 'indisell_idempotency',
          status: PaymentStatus.PAID,
          gatewayTxnId: payloadHash,
        },
        { upsert: true, new: true },
      );
    } catch (saveErr) {
      this.logger.warn(`Failed to store idempotency record for ${key}: ${saveErr.message}`);
    }

    return result;
  }

  // =========================================================================
  // 3. MAIN CONNECTOR DISPATCHER
  // =========================================================================
  async handleConnector(rawBody: string, headers: Record<string, any>): Promise<ConnectorResponse> {
    this.verifyConnectorSignature(rawBody, headers);

    let parsed: ConnectorRequest;
    try {
      parsed = JSON.parse(rawBody);
    } catch (err) {
      throw new BadRequestException('invalid_json');
    }

    const ALLOWED_ACTIONS = new Set(['health', 'quote', 'prepare', 'complete', 'status', 'release']);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((k) => !['version', 'requestId', 'action', 'data'].includes(k)) ||
      parsed.version !== 1 ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(parsed.requestId || '') ||
      !ALLOWED_ACTIONS.has(parsed.action) ||
      typeof parsed.data !== 'object' ||
      parsed.data === null ||
      Array.isArray(parsed.data)
    ) {
      throw new BadRequestException('invalid_request');
    }

    const { action, requestId, data } = parsed;
    const isMutation = ['prepare', 'complete', 'release'].includes(action);

    const executeAction = async () => {
      switch (action) {
        case 'health':
          return this.executeHealth();
        case 'quote':
          return this.executeQuote(data as QuoteRequest);
        case 'prepare':
          return this.executePrepare(data as PrepareRequest, requestId);
        case 'complete':
          return this.executeComplete(data as CompleteRequest);
        case 'status':
          return this.executeStatus(data);
        case 'release':
          return this.executeRelease(data);
        default:
          throw new BadRequestException(`Unsupported action: ${action}`);
      }
    };

    const resultData = isMutation
      ? await this.withIdempotency(action, requestId, rawBody, executeAction)
      : await executeAction();

    return {
      version: 1,
      merchantKey: this.merchantKey,
      requestId,
      action,
      ok: true,
      data: resultData,
    };
  }

  // =========================================================================
  // 4. ACTION IMPLEMENTATIONS
  // =========================================================================

  private async executeHealth() {
    return {
      status: 'healthy',
      store: 'Tohay Kids Festive Wear',
      version: '1.0.0',
      currency: 'INR',
      methods: ['online', 'cod'],
      capabilities: ['health', 'quote', 'prepare', 'complete', 'status', 'release'],
      timestamp: new Date().toISOString(),
    };
  }

  private async executeQuote(data: QuoteRequest): Promise<Quote> {
    const cartId = data.cartId || '';
    const cartVersion = data.cartVersion || 'v1';
    const method = data.method || 'online';

    let itemsToProcess: any[] = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    if (itemsToProcess.length === 0 && cartId) {
      try {
        const foundCart = Types.ObjectId.isValid(cartId)
          ? await this.cartModel.findOne({ $or: [{ _id: cartId }, { user: cartId }] }).populate('items.product').exec()
          : null;
        if (foundCart && Array.isArray(foundCart.items)) {
          itemsToProcess = foundCart.items;
        }
      } catch (err) { }
    }

    if (itemsToProcess.length === 0) {
      return {
        quoteId: `qt_${Date.now().toString(36)}`,
        cartId,
        cartVersion,
        currency: 'INR',
        method,
        expiresAt: Date.now() + 5 * 60 * 1000,
        items: [],
        subtotalMinor: 0,
        discountMinor: 0,
        shippingMinor: 0,
        taxMinor: 0,
        codFeeMinor: 0,
        totalMinor: 0,
        codAvailable: true,
      };
    }

    let subtotalMinor = 0;
    const quoteItems: any[] = [];

    for (const item of itemsToProcess) {
      const pId = item.productId || item.product?.id || item.id || item.variantId;
      const product = pId ? await this.productModel.findOne({ $or: [{ id: pId }, { _id: Types.ObjectId.isValid(pId) ? pId : null }] }).exec() : null;

      const qty = Math.max(1, Number(item.qty || item.quantity || 1));
      let itemPrice = product ? product.price : Number(item.price || item.unitPrice || 0);

      const itemSize = item.size || 'Standard';
      if (product && Array.isArray(product.sizeVariants)) {
        const matched = product.sizeVariants.find((v) => v.size === itemSize);
        if (matched && Number(matched.price) > 0) {
          itemPrice = Number(matched.price);
        }
      }

      const unitPriceMinor = Math.round(itemPrice * 100);
      subtotalMinor += unitPriceMinor * qty;

      quoteItems.push({
        variantId: `${pId}_${itemSize}`,
        title: product ? `${product.name} (${itemSize})` : item.name || 'Festive Kids Outfit',
        quantity: qty,
        unitPriceMinor,
      });
    }

    const freeShippingThresholdMinor = 999 * 100;
    const shippingMinor = subtotalMinor >= freeShippingThresholdMinor || subtotalMinor === 0 ? 0 : 50 * 100;

    let discountMinor = 0;
    if (data.couponCode) {
      discountMinor = Math.round(subtotalMinor * 0.1);
    }

    const taxMinor = 0;
    const codFeeMinor = 0;
    const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingMinor + taxMinor + codFeeMinor);

    const quoteId = `qt_${createHash('sha256').update(cartId + cartVersion + subtotalMinor).digest('hex').slice(0, 16)}`;

    return {
      quoteId,
      cartId,
      cartVersion,
      currency: 'INR',
      method,
      expiresAt: Date.now() + 5 * 60 * 1000,
      items: quoteItems,
      subtotalMinor,
      discountMinor,
      shippingMinor,
      taxMinor,
      codFeeMinor,
      totalMinor,
      codAvailable: true,
    };
  }

  private async executePrepare(data: PrepareRequest, requestId: string): Promise<BoundOrder> {
    const { cartId, cartVersion, quoteId, attemptId, phone, address, method } = data;

    const existing = await this.orderModel.findOne({
      $or: [{ razorpayOrderId: attemptId }, { id: attemptId }],
    }).exec();

    if (existing) {
      return {
        orderId: existing.id,
        name: existing.id,
        attemptId,
        quoteId,
        totalMinor: Math.round(existing.totalAmount * 100),
        currency: 'INR',
        method,
        financialStatus: 'pending',
      };
    }

    const quote = await this.executeQuote({
      cartId,
      cartVersion,
      method,
      phone,
      address,
      items: data.items,
    });

    const orderId = `TK${Math.floor(10000 + Math.random() * 90000)}`;
    const totalAmount = quote.totalMinor / 100;
    const subtotal = quote.subtotalMinor / 100;
    const discount = quote.discountMinor / 100;
    const shipping = quote.shippingMinor / 100;

    const orderItems = quote.items.map((item) => ({
      productId: item.variantId.split('_')[0] || 'TK1001',
      name: item.title,
      price: item.unitPriceMinor / 100,
      qty: item.quantity,
      size: item.variantId.split('_')[1] || 'Standard',
      image: '',
    }));

    let userObj: any = null;
    if (Types.ObjectId.isValid(cartId)) {
      userObj = await this.userModel.findById(cartId).exec();
    }
    if (!userObj && phone) {
      userObj = await this.userModel.findOne({ phone: { $regex: phone } }).exec();
    }

    const newOrder = new this.orderModel({
      id: orderId,
      user: userObj ? userObj._id : new Types.ObjectId(),
      customerName: address?.name || userObj?.name || 'Customer',
      customerEmail: userObj?.email || `customer_${phone || orderId}@tohay.in`,
      customerPhone: phone || userObj?.phone || '',
      items: orderItems,
      itemsCount: orderItems.reduce((acc, i) => acc + i.qty, 0),
      subtotal,
      discount,
      shipping,
      tax: 0,
      totalAmount,
      paymentMethod: method === 'online' ? 'Razorpay (IndiSell)' : 'Cash on Delivery (IndiSell)',
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.PROCESSING,
      shippingAddress: {
        flat: address?.address1 || 'Address',
        street: address?.address2 || '',
        city: address?.city || 'City',
        state: address?.state || 'State',
        pincode: address?.zip || '000000',
      },
      timeline: [
        {
          status: 'Order Placed (IndiSell 1-Click Checkout)',
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          completed: true,
          note: `Checkout Attempt: ${attemptId} | Quote: ${quoteId}`,
        },
      ],
      razorpayOrderId: attemptId,
    });

    await newOrder.save();
    this.logger.log(`Prepared pending order ${orderId} for attempt ${attemptId}`);

    return {
      orderId,
      name: orderId,
      attemptId,
      quoteId,
      totalMinor: quote.totalMinor,
      currency: 'INR',
      method,
      financialStatus: 'pending',
    };
  }

  private async executeComplete(data: CompleteRequest): Promise<BoundOrder> {
    const { orderId, attemptId, quoteId, method, amountMinor, paymentRef, providerOrderId } = data;

    const order = await this.orderModel.findOne({
      $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
    }).exec();

    if (!order) {
      this.logger.error(`Order not found for completion: orderId=${orderId}, attemptId=${attemptId}`);
      throw new NotFoundException('order_not_found');
    }

    const isPaid = method === 'online';
    order.paymentStatus = isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING;
    order.orderStatus = OrderStatus.CONFIRMED;
    if (paymentRef) order.razorpayPaymentId = paymentRef;
    if (providerOrderId) order.razorpayOrderId = providerOrderId;

    order.timeline.push({
      status: isPaid ? 'Payment Confirmed' : 'COD Order Confirmed',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      completed: true,
      note: isPaid ? `Payment Ref: ${paymentRef || 'N/A'}` : 'Cash to be collected upon delivery',
    });

    await order.save();
    this.logger.log(`Confirmed order ${order.id} with status ${order.orderStatus}`);

    if (order.user) {
      try {
        await this.cartModel.findOneAndUpdate({ user: order.user }, { items: [] }).exec();
      } catch (err) { }
    }

    return {
      orderId: order.id,
      name: order.id,
      attemptId,
      quoteId,
      totalMinor: amountMinor,
      currency: 'INR',
      method,
      financialStatus: isPaid ? 'paid' : 'pending',
    };
  }

  private async executeStatus(data: any) {
    const { orderId, attemptId } = data;
    const order = await this.orderModel.findOne({
      $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
    }).exec();

    if (!order) {
      return { status: 'unknown', orderId: null };
    }

    return {
      status: order.orderStatus === OrderStatus.CANCELLED ? 'cancelled' : 'confirmed',
      orderId: order.id,
      financialStatus: order.paymentStatus === PaymentStatus.PAID ? 'paid' : 'pending',
      amountMinor: Math.round(order.totalAmount * 100),
      currency: 'INR',
    };
  }

  private async executeRelease(data: any) {
    const { orderId, attemptId } = data;
    const order = await this.orderModel.findOne({
      $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
    }).exec();

    if (!order) {
      return { released: false, reason: 'order_not_found' };
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.warn(`Cannot release paid order ${order.id}`);
      return { released: false, reason: 'already_paid' };
    }

    order.orderStatus = OrderStatus.CANCELLED;
    order.timeline.push({
      status: 'Order Cancelled',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      completed: true,
      note: 'Checkout abandoned or payment unconfirmed',
    });
    await order.save();

    return { released: true, orderId: order.id };
  }

  // =========================================================================
  // 5. CUSTOMER SESSION BRIDGE (/api/checkout/session & /api/checkout/verify)
  // =========================================================================

  async createCheckoutSession(userId: string | null, cartId: string, cartVersion: string) {
    const customerId = userId || `guest_${cartId || Date.now().toString(36)}`;
    const safeCartId = cartId || customerId;
    const safeCartVersion = cartVersion || 'v1';
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const rawPayload = JSON.stringify({
      requestId,
      cartId: safeCartId,
      cartVersion: safeCartVersion,
    });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', this.connectorSecret)
      .update(`custom-session-create-v1.${this.merchantKey}.${timestamp}.${rawPayload}`)
      .digest('hex');

    let sessionRes: any = null;
    try {
      const response = await fetch(`${this.checkoutOrigin}/api/custom/v1/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IndiSell-Merchant-Key': this.merchantKey,
          'X-IndiSell-Timestamp': timestamp,
          'X-IndiSell-Signature': signature,
        },
        body: rawPayload,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Upstream IndiSell responded with status ${response.status}`);
      }
      sessionRes = await response.json();
    } catch (upstreamErr) {
      this.logger.log(`IndiSell remote host not live yet — created local checkout session for testing`);
      const fallbackSessionId = `session_${createHash('sha256').update(requestId + safeCartId).digest('hex').slice(0, 43)}`;
      const isPlaceholder =
        !this.checkoutOrigin ||
        this.checkoutOrigin.includes('checkout.indisell.com') ||
        this.checkoutOrigin.includes('APPROVED-CHECKOUT.example') ||
        this.checkoutOrigin.includes('localhost');

      const checkoutUrl = isPlaceholder
        ? `/indisell-checkout?mk=${this.merchantKey}#${fallbackSessionId}`
        : `${this.checkoutOrigin}/custom-checkout?mk=${this.merchantKey}#${fallbackSessionId}`;

      sessionRes = {
        checkoutSessionId: fallbackSessionId,
        checkoutUrl,
      };
    }

    const sessionHash = createHash('sha256').update(sessionRes.checkoutSessionId).digest('hex');

    this.memorySessions.set(sessionHash, {
      customerId,
      cartId: safeCartId,
      cartVersion: safeCartVersion,
      checkoutSessionId: sessionRes.checkoutSessionId,
      status: 'created',
    });

    try {
      await this.paymentModel.findOneAndUpdate(
        { txnId: `sess_${sessionHash}` },
        {
          txnId: `sess_${sessionHash}`,
          orderId: sessionRes.checkoutSessionId,
          customerName: customerId,
          amount: 0,
          method: 'indisell_session',
          status: PaymentStatus.PENDING,
          gatewayTxnId: safeCartId,
        },
        { upsert: true, new: true },
      );
    } catch (saveErr) {
      this.logger.warn(`Failed to store session in payments collection: ${saveErr.message}`);
    }

    return {
      checkoutSessionId: sessionRes.checkoutSessionId,
      checkoutUrl: sessionRes.checkoutUrl,
    };
  }

  async verifyCheckoutSession(userId: string | null, checkoutSessionId: string) {
    const sessionHash = createHash('sha256').update(checkoutSessionId).digest('hex');
    const cached = this.memorySessions.get(sessionHash);

    let status = cached?.status === 'completed' ? 'confirmed' : 'pending';
    let orderId = cached?.orderId || null;

    try {
      const response = await fetch(`${this.checkoutOrigin}/api/custom/v1/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${checkoutSessionId}`,
        },
        body: '{}',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const upstreamData = await response.json();
        if (upstreamData.status === 'confirmed') {
          status = 'confirmed';
          orderId = upstreamData.orderId || orderId;
          if (cached) {
            cached.status = 'completed';
            cached.orderId = orderId;
          }
        }
      }
    } catch (err) {
      this.logger.debug(`Upstream status check fallback: ${err.message}`);
    }

    return {
      checkoutSessionId,
      status,
      orderId,
    };
  }
}

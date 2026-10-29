import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { InventoryAdjustment, InventoryAdjustmentDocument } from '../inventory/schemas/inventory-adjustment.schema';
import { OrderStatus, PaymentStatus } from '../common/enums';
import {
  ConnectorRequest,
  ConnectorResponse,
  Quote,
  QuoteRequest,
  PrepareRequest,
  CompleteRequest,
  BoundOrder,
} from './interfaces/indisell.interfaces';
import {
  createCheckoutBridge,
  handleWebRouteWithExpress,
  BridgeCustomer,
  BridgeOwnedCart,
  BridgeSessionBinding,
} from './checkout-bridge';

@Injectable()
export class IndiSellService implements OnModuleInit {
  private readonly logger = new Logger(IndiSellService.name);
  private readonly merchantKey: string;
  private readonly connectorSecret: string;
  private readonly checkoutOrigin: string;
  private readonly storefrontOrigin: string;

  private bridge: ReturnType<typeof createCheckoutBridge>;

  // In-memory caching for lightning fast lookup + persistent storage in existing collections
  private readonly memoryIdempotency = new Map<string, { payloadHash: string; response: any }>();
  private readonly memorySessions = new Map<
    string,
    { customerId: string; cartId: string; cartVersion: string; checkoutSessionId: string; status: string; orderId?: string }
  >();
  private readonly memoryCarts = new Map<
    string,
    { id: string; version: string; ownerId: string; requestId: string; items: any[]; subtotal?: number }
  >();

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
    this.merchantKey = this.configService.get<string>('INDISELL_MERCHANT_KEY') || 'mk_64f88bba76bab9d17f26b11f';
    this.connectorSecret =
      this.configService.get<string>('INDISELL_CONNECTOR_SECRET') ||
      'c70e5639b61bc9697652242139e76dd8fb498e10';
    this.checkoutOrigin =
      this.configService.get<string>('INDISELL_CHECKOUT_ORIGIN') || 'https://cart.indisell.io';
    this.storefrontOrigin =
      this.configService.get<string>('INDISELL_STOREFRONT_ORIGIN') || 'https://tohay.in';
  }

  onModuleInit() {
    this.bridge = createCheckoutBridge({
      checkoutOrigin: this.checkoutOrigin,
      storefrontOrigin: this.storefrontOrigin,
      merchantKey: this.merchantKey,
      connectorSecret: this.connectorSecret,
      authenticateCustomer: this.authenticateCustomer.bind(this),
      loadOwnedCart: this.loadOwnedCart.bind(this),
      rememberSession: this.rememberSession.bind(this),
      ownsSession: this.ownsSession.bind(this),
    });
    this.logger.log('IndiSell createCheckoutBridge initialized successfully');
  }

  // =========================================================================
  // 1. SIGNATURE VERIFICATION (Signed Server-to-Server Connector)
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
  // 2. IDEMPOTENCY HANDLER (DB-backed + In-memory)
  // =========================================================================
  async withIdempotency<T>(
    action: string,
    requestId: string,
    rawBody: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const key = `${this.merchantKey}:${action}:${requestId}`;

    // 1. In-memory check
    const cached = this.memoryIdempotency.get(key);
    if (cached) {
      if (cached.payloadHash !== payloadHash) {
        throw new ConflictException('operation_conflict');
      }
      return cached.response as T;
    }

    // 2. Persisted check in payments collection
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
    } catch (err) {
      this.logger.warn(`Idempotency lookup warning: ${err.message}`);
    }

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
  // 3. MAIN CONNECTOR DISPATCHER (/api/indisell/connector)
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
      currency: 'INR',
      capabilities: ['quote', 'prepare', 'complete', 'status', 'release'],
    };
  }

  private async executeQuote(data: QuoteRequest): Promise<Quote> {
    const cartId = data.cartId || '';
    const cartVersion = data.cartVersion || 'v1';
    const method = data.method || 'online';

    let itemsToProcess: any[] = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    if (itemsToProcess.length === 0 && cartId) {
      try {
        // 1. Check in-memory cart cache
        const memCart = this.memoryCarts.get(cartId);
        if (memCart && Array.isArray(memCart.items) && memCart.items.length > 0) {
          itemsToProcess = memCart.items;
        } else {
          // 2. Check persisted cart record in payments collection
          const dbCart = await this.paymentModel.findOne({ txnId: `cart_${cartId}` }).exec();
          if (dbCart && dbCart.customerName) {
            let payload: any = null;
            try {
              payload = JSON.parse(dbCart.customerName);
            } catch (_) {
              payload = { ownerId: dbCart.customerName, items: [] };
            }
            if (Array.isArray(payload?.items) && payload.items.length > 0) {
              itemsToProcess = payload.items;
              this.memoryCarts.set(cartId, {
                id: cartId,
                version: dbCart.gatewayTxnId || 'v1',
                ownerId: payload.ownerId,
                requestId: dbCart.orderId,
                items: payload.items,
              });
            }
          }

          // 3. Check standard Cart collection if cartId is user ObjectId
          if (itemsToProcess.length === 0 && Types.ObjectId.isValid(cartId)) {
            const foundCart = await this.cartModel.findOne({ $or: [{ _id: cartId }, { user: cartId }] }).populate('items.product').exec();
            if (foundCart && Array.isArray(foundCart.items) && foundCart.items.length > 0) {
              itemsToProcess = foundCart.items;
            }
          }
        }
      } catch (err) {
        this.logger.warn(`executeQuote cart lookup warning for ${cartId}: ${err.message}`);
      }
    }

    if (itemsToProcess.length === 0) {
      this.logger.error(`executeQuote rejected: no items found for cartId=${cartId}`);
      throw new BadRequestException('invalid_cart');
    }

    let subtotalMinor = 0;
    const quoteItems: any[] = [];

    for (const item of itemsToProcess) {
      const pId = item.productId || item.product?.id || item.product?._id || item.id || item.variantId;
      const product = pId
        ? await this.productModel.findOne({
            $or: [
              { id: String(pId) },
              { _id: Types.ObjectId.isValid(pId) ? new Types.ObjectId(pId) : null },
            ].filter((c) => Object.values(c)[0] !== null),
          }).exec()
        : null;

      const qty = Math.max(1, Number(item.qty || item.quantity || 1));
      let itemPrice = product ? product.price : Number(item.price || item.unitPrice || 0);

      const itemSize = item.size || 'Standard';
      if (product && Array.isArray(product.sizeVariants)) {
        const matched = product.sizeVariants.find((v) => v.size === itemSize);
        if (matched && Number(matched.price) > 0) {
          itemPrice = Number(matched.price);
        }
      }

      // Ensure price is at least 1 INR (100 paise)
      const unitPriceMinor = Math.max(100, Math.round(Number(itemPrice || 1) * 100));
      subtotalMinor += unitPriceMinor * qty;

      const imgUrl = (product && Array.isArray(product.images) && product.images[0]) || (product as any)?.image || item.image || '';
      const fullImageUrl = imgUrl
        ? (imgUrl.startsWith('http') ? imgUrl : `https://tohay.in${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`)
        : 'https://tohay.in/assets/logo.png';

      quoteItems.push({
        variantId: `${pId || 'TK1001'}_${itemSize}`,
        productId: product ? String(product.id || product._id) : String(pId || 'TK1001'),
        title: product ? `${product.name} (${itemSize})` : item.name || 'Festive Kids Outfit',
        variantTitle: itemSize,
        quantity: qty,
        unitPriceMinor,
        imageUrl: fullImageUrl,
        productUrl: product ? `https://tohay.in/product/${product.slug || product.id}` : undefined,
      });
    }

    const freeShippingThresholdMinor = 1499 * 100;
    const shippingMinor = subtotalMinor >= freeShippingThresholdMinor ? 0 : 99 * 100;

    let discountMinor = 0;
    if (data.couponCode) {
      discountMinor = Math.round(subtotalMinor * 0.1);
    }

    const taxMinor = 0;
    const codFeeMinor = 0;
    const totalMinor = Math.max(100, subtotalMinor - discountMinor + shippingMinor + taxMinor + codFeeMinor);

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

    const existing = await this.orderModel
      .findOne({
        $or: [{ razorpayOrderId: attemptId }, { id: attemptId }],
      })
      .exec();

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

    const order = await this.orderModel
      .findOne({
        $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
      })
      .exec();

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
    const order = await this.orderModel
      .findOne({
        $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
      })
      .exec();

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
    const order = await this.orderModel
      .findOne({
        $or: [{ id: orderId }, { razorpayOrderId: attemptId }],
      })
      .exec();

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
  // 5. OFFICIAL INDISELL CHECKOUT BRIDGE CALLBACKS
  // =========================================================================

  async authenticateCustomer(req: Request): Promise<BridgeCustomer | null> {
    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        if (token.startsWith('guest_')) {
          const guestId = token.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
          if (guestId) return { id: guestId };
        }
        try {
          const secret = this.configService.get<string>('JWT_SECRET') || 'lokeshkumar';
          const decoded: any = jwt.verify(token, secret);
          const userId = decoded?.userId || decoded?.id || decoded?.sub || decoded?._id;
          if (userId && typeof userId === 'string') {
            return { id: userId.slice(0, 128) };
          }
        } catch (_) {
          // Token invalid or expired
        }
      }
    }

    // 2. Check Cookie session
    const cookieHeader = req.headers.get('cookie') || '';
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:tohay_guest_id|tohay_session|guest_id|sessionId)=([^;]+)/);
      if (match && match[1]) {
        const guestId = decodeURIComponent(match[1].trim()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
        if (guestId) return { id: guestId };
      }
    }

    // 3. Check custom header (for testing / integrations)
    const testHeader = req.headers.get('x-customer-id') || req.headers.get('x-test-customer-id');
    if (testHeader && typeof testHeader === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(testHeader)) {
      return { id: testHeader };
    }

    return null;
  }

  async loadOwnedCart(customerId: string, cartId: string): Promise<BridgeOwnedCart | null> {
    // 1. Check in-memory cart cache
    const memCart = this.memoryCarts.get(cartId);
    if (memCart && memCart.ownerId === customerId && Array.isArray(memCart.items) && memCart.items.length > 0) {
      return {
        id: memCart.id,
        version: memCart.version || 'v1',
        ownerId: memCart.ownerId,
        requestId: memCart.requestId,
      };
    }

    // 2. Check in payments collection (using existing collection)
    try {
      const dbCart = await this.paymentModel.findOne({ txnId: `cart_${cartId}` }).exec();
      if (dbCart && dbCart.customerName) {
        let payload: any = null;
        try {
          payload = JSON.parse(dbCart.customerName);
        } catch (_) {
          payload = { ownerId: dbCart.customerName, items: [] };
        }

        if (payload.ownerId === customerId && Array.isArray(payload.items) && payload.items.length > 0) {
          this.memoryCarts.set(cartId, {
            id: cartId,
            version: dbCart.gatewayTxnId || 'v1',
            ownerId: customerId,
            requestId: dbCart.orderId,
            items: payload.items,
            subtotal: dbCart.amount,
          });

          return {
            id: cartId,
            version: dbCart.gatewayTxnId || 'v1',
            ownerId: customerId,
            requestId: dbCart.orderId,
          };
        }
      }
    } catch (err) {
      this.logger.warn(`loadOwnedCart DB lookup error for cart_${cartId}: ${err.message}`);
    }

    // 3. Check standard Cart collection for logged-in user
    if (Types.ObjectId.isValid(customerId)) {
      try {
        const userCart = await this.cartModel.findOne({ user: customerId }).populate('items.product').exec();
        if (userCart && Array.isArray(userCart.items) && userCart.items.length > 0) {
          const version = String((userCart as any).updatedAt ? (userCart as any).updatedAt.getTime() : '1');
          const requestId = `req_usercart_${userCart._id}_${version}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);

          this.memoryCarts.set(cartId, {
            id: cartId,
            version,
            ownerId: customerId,
            requestId,
            items: userCart.items,
          });

          return {
            id: cartId,
            version,
            ownerId: customerId,
            requestId,
          };
        }
      } catch (_) { }
    }

    // If cart was not found or does not belong to customerId or has 0 items: return null!
    // Never fabricate a synthetic empty cart.
    return null;
  }

  async rememberSession(binding: BridgeSessionBinding): Promise<boolean> {
    try {
      this.memorySessions.set(binding.sessionHash, {
        customerId: binding.customerId,
        cartId: binding.cartId,
        cartVersion: binding.cartVersion,
        checkoutSessionId: '',
        status: 'created',
      });

      await this.paymentModel.findOneAndUpdate(
        { txnId: `sess_${binding.sessionHash}` },
        {
          txnId: `sess_${binding.sessionHash}`,
          orderId: binding.cartId,
          customerName: binding.customerId,
          amount: 0,
          method: 'indisell_session',
          status: PaymentStatus.PENDING,
          gatewayTxnId: binding.cartVersion,
        },
        { upsert: true, new: true },
      );
      return true;
    } catch (err) {
      this.logger.error(`Failed to remember session: ${err.message}`);
      return false;
    }
  }

  async ownsSession(customerId: string, sessionHash: string): Promise<boolean> {
    const cached = this.memorySessions.get(sessionHash);
    if (cached && cached.customerId === customerId) {
      return true;
    }

    try {
      const session = await this.paymentModel.findOne({ txnId: `sess_${sessionHash}` }).exec();
      if (session && session.customerName === customerId) {
        return true;
      }
    } catch (_) { }

    return false;
  }

  // =========================================================================
  // 6. STOREFRONT BRIDGE ROUTE HANDLERS (/api/checkout/session & verify)
  // =========================================================================

  async handleSessionBridge(req: any, res: any) {
    return handleWebRouteWithExpress(this.bridge.session, req, res);
  }

  async handleVerifyBridge(req: any, res: any) {
    return handleWebRouteWithExpress(this.bridge.verify, req, res);
  }

  async syncOwnedCart(customerId: string, cartId: string, items: any[], subtotal?: number) {
    const version = 'v1';
    const requestId = `req_cart_${cartId.replace(/[^A-Za-z0-9_-]/g, '_')}_${Date.now().toString(36)}`.slice(0, 64);

    const sanitizedItems = items.map((i) => ({
      productId: String(i.productId || i.product?.id || i.product?._id || i.id || i.variantId || 'TK1001'),
      name: String(i.name || i.title || i.product?.name || 'Festive Kids Outfit'),
      size: String(i.size || 'Standard'),
      qty: Math.max(1, Number(i.qty || i.quantity || 1)),
      price: Math.max(0, Number(i.price || i.unitPrice || 0)),
    }));

    const cartPayload = {
      ownerId: customerId,
      items: sanitizedItems,
      subtotal: Number(subtotal || 0),
    };

    this.memoryCarts.set(cartId, {
      id: cartId,
      ownerId: customerId,
      version,
      requestId,
      items: sanitizedItems,
      subtotal: Number(subtotal || 0),
    });

    try {
      await this.paymentModel.findOneAndUpdate(
        { txnId: `cart_${cartId}` },
        {
          txnId: `cart_${cartId}`,
          orderId: requestId,
          customerName: JSON.stringify(cartPayload),
          amount: Number(subtotal || 0),
          method: 'indisell_cart',
          status: PaymentStatus.PENDING,
          gatewayTxnId: version,
        },
        { upsert: true, new: true },
      );
    } catch (saveErr) {
      this.logger.error(`Failed to persist cart_${cartId} in payments collection: ${saveErr.message}`);
      throw new InternalServerErrorException('cart_save_failed');
    }

    return { ok: true, cartId, customerId, version };
  }
}

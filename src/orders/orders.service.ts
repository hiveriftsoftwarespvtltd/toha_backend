import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { InventoryAdjustment, InventoryAdjustmentDocument } from '../inventory/schemas/inventory-adjustment.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus, StockAdjustmentType } from '../common/enums';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(InventoryAdjustment.name) private inventoryModel: Model<InventoryAdjustmentDocument>,
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const user = userId ? await this.userModel.findById(userId).exec() : null;

    const rawItems = (createOrderDto.items && createOrderDto.items.length > 0)
      ? createOrderDto.items
      : null;

    let dbCart: any = null;
    if (!rawItems && userId) {
      dbCart = await this.cartModel.findOne({ user: userId }).exec();
    }

    const itemsToProcess = rawItems || (dbCart ? dbCart.items : []);

    if (!itemsToProcess || itemsToProcess.length === 0) {
      throw new BadRequestException('Cart is empty. Please add items before checking out.');
    }

    const orderItems: any[] = [];
    let subtotal = 0;

    for (const item of itemsToProcess) {
      const pId = item.productId || item.product?.id || item.id;
      const product = pId ? await this.productModel.findOne({ id: pId }).exec() : null;

      const itemQty = Number(item.qty) || 1;
      const itemPrice = product ? product.price : (Number(item.price) || 0);
      const itemName = product ? product.name : (item.name || item.product?.name || 'Festive Outfit');
      const itemImage = product && product.images && product.images.length > 0
        ? product.images[0]
        : (item.image || item.product?.images?.[0] || '');

      subtotal += itemPrice * itemQty;

      orderItems.push({
        productId: pId || 'P1001',
        name: itemName,
        price: itemPrice,
        qty: itemQty,
        size: item.size || 'Standard',
        image: itemImage,
      });

      if (product) {
        if (product.stock < itemQty) {
          throw new BadRequestException(`Sorry, "${product.name}" is currently out of stock (Available: ${product.stock} units).`);
        }
        const prevStock = product.stock;
        const newStock = Math.max(0, prevStock - itemQty);
        product.stock = newStock;
        await product.save();

        await new this.inventoryModel({
          productId: product.id,
          productName: product.name,
          previousStock: prevStock,
          adjustment: -itemQty,
          newStock,
          type: StockAdjustmentType.SALE,
          reason: 'Customer Order Placement',
        }).save();
      }
    }

    const discount = createOrderDto.discount || 0;
    const freeShippingThreshold = 1499;
    const shipping = createOrderDto.shipping ?? (subtotal >= freeShippingThreshold ? 0 : 99);
    const tax = createOrderDto.tax || Math.round((subtotal - discount) * 0.05);
    const totalAmount = createOrderDto.totalAmount || Math.max(0, subtotal - discount + shipping);

    const orderId = `TK${Math.floor(10000 + Math.random() * 90000)}`;
    const isRazorpay = (createOrderDto.paymentMethod || '').toUpperCase().includes('RAZORPAY') || (createOrderDto.paymentMethod || '').toUpperCase().includes('CARD') || (createOrderDto.paymentMethod || '').toUpperCase().includes('UPI');
    const paymentStatus = isRazorpay ? PaymentStatus.PAID : PaymentStatus.PENDING;

    const timeline = [
      { status: 'Placed', date: new Date().toLocaleString(), completed: true, note: 'Order placed successfully' },
      { status: 'Confirmed', date: new Date().toLocaleString(), completed: true, note: 'Order verified' },
      { status: 'Processing', date: new Date().toLocaleString(), completed: true, note: 'Packing at warehouse' },
      { status: 'Shipped', date: 'Pending', completed: false, note: 'Awaiting courier dispatch' },
      { status: 'Delivered', date: 'Pending', completed: false, note: 'Estimated delivery in 2-3 days' },
    ];

    const customerName = createOrderDto.shippingAddress?.name || user?.name || 'Valued Parent';
    const customerEmail = createOrderDto.shippingAddress?.email || user?.email || 'parent@tohaykids.com';
    const customerPhone = createOrderDto.shippingAddress?.phone || user?.phone || '+91 98765 43210';

    const newOrder = new this.orderModel({
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
      paymentMethod: createOrderDto.paymentMethod || 'COD',
      paymentStatus,
      orderStatus: OrderStatus.PROCESSING,
      shippingAddress: createOrderDto.shippingAddress,
      timeline,
      courier: { name: 'BlueDart Express', trackingNumber: `AWB${Math.floor(100000 + Math.random() * 900000)}` },
      razorpayOrderId: createOrderDto.razorpayOrderId || '',
      razorpayPaymentId: createOrderDto.razorpayPaymentId || '',
    });

    const savedOrder = await newOrder.save();

    if (userId) {
      await this.cartModel.findOneAndUpdate({ user: userId }, { items: [], discountPercent: 0 }).exec();
    }

    return savedOrder;
  }

  async findCustomerOrders(userId: string) {
    return await this.orderModel.find({ user: userId }).sort({ createdAt: -1 }).exec();
  }

  async findOrderById(id: string) {
    const order = await this.orderModel.findOne({ id }).exec();
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  async trackOrder(orderNumber: string) {
    const order = await this.orderModel.findOne({ id: orderNumber }).exec();
    if (!order) {
      throw new NotFoundException(`Order #${orderNumber} not found`);
    }

    return {
      orderNumber: order.id,
      customerName: order.customerName,
      status: order.orderStatus,
      paymentStatus: order.paymentStatus,
      total: order.totalAmount,
      itemsCount: order.itemsCount,
      address: `${order.shippingAddress.flat}, ${order.shippingAddress.street}, ${order.shippingAddress.city}`,
      courier: order.courier,
      timeline: order.timeline,
      items: order.items,
    };
  }

  async findAllAdminOrders(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status.toLowerCase() !== 'all') {
      filter.orderStatus = new RegExp(`^${query.status}$`, 'i');
    }
    if (query.search) {
      filter.$or = [
        { id: new RegExp(query.search, 'i') },
        { customerName: new RegExp(query.search, 'i') },
        { customerEmail: new RegExp(query.search, 'i') },
        { customerPhone: new RegExp(query.search, 'i') },
      ];
    }

    const [total, orders] = await Promise.all([
      this.orderModel.countDocuments(filter).exec(),
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const order = await this.orderModel.findOne({ id: orderId }).exec();
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    order.orderStatus = newStatus;
    if (newStatus === OrderStatus.DELIVERED) {
      order.paymentStatus = PaymentStatus.PAID;
    }

    order.timeline = order.timeline.map((t) => {
      if (t.status.toLowerCase() === newStatus.toLowerCase()) {
        return { ...t, completed: true, date: new Date().toLocaleString() };
      }
      return t;
    });

    return await order.save();
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.orderModel.findOne({ id: orderId, user: userId }).exec();
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    order.orderStatus = OrderStatus.CANCELLED;
    order.timeline.push({
      status: 'Cancelled',
      date: new Date().toLocaleString(),
      completed: true,
      note: 'Order cancelled by customer',
    });

    return await order.save();
  }
}

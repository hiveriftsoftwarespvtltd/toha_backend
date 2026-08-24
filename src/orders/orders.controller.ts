import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { OrderStatus, Role } from '../common/enums';

@ApiTags('Orders & Tracking')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Customer: Place new order (COD or Razorpay)' })
  async createOrder(@CurrentUser() user: UserDocument, @Body() createOrderDto: CreateOrderDto) {
    const userId = user ? user._id.toString() : null;
    const data = await this.ordersService.createOrder(userId, createOrderDto);
    return {
      success: true,
      message: `Order #${data.id} placed successfully!`,
      data,
    };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: Get my order history' })
  async getMyOrders(@CurrentUser() user: UserDocument) {
    const data = await this.ordersService.findCustomerOrders(user._id.toString());
    return { success: true, message: 'Orders retrieved', data };
  }

  @Get('orders/track/:orderNumber')
  @ApiOperation({ summary: 'Public: Track order status timeline by Order ID' })
  async trackOrder(@Param('orderNumber') orderNumber: string) {
    const data = await this.ordersService.trackOrder(orderNumber);
    return { success: true, message: 'Tracking information retrieved', data };
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer/Admin: Get order details by ID' })
  async getOrderById(@Param('id') id: string) {
    const data = await this.ordersService.findOrderById(id);
    return { success: true, message: 'Order details retrieved', data };
  }

  @Patch('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: Cancel order' })
  async cancelOrder(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.ordersService.cancelOrder(user._id.toString(), id);
    return { success: true, message: `Order #${id} cancelled`, data };
  }

  // --- ADMIN ORDER APIS ---

  @Get('admin/orders')
  @Get('orders/all')
  @ApiOperation({ summary: 'Admin: Get all store orders with status filter' })
  async getAllAdminOrders(@Query('status') status?: string, @Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.ordersService.findAllAdminOrders({ status, search, page, limit });
    return {
      success: true,
      message: 'Orders list retrieved',
      data: result.data,
      meta: result.meta,
    };
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update order status (Processing, Shipped, Delivered, etc.)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    const data = await this.ordersService.updateOrderStatus(id, status);
    return {
      success: true,
      message: `Order #${id} status updated to ${status}`,
      data,
    };
  }
}

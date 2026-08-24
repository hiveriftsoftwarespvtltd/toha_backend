import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Cart & Bag')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart with calculated subtotal & discounts' })
  async getCart(@CurrentUser() user: UserDocument) {
    const data = await this.cartService.getCart(user._id.toString());
    return { success: true, message: 'Cart retrieved', data };
  }

  @Post('items')
  @ApiOperation({ summary: 'Add product item to cart' })
  async addItem(
    @CurrentUser() user: UserDocument,
    @Body() body: { productId: string; size?: string; qty?: number; child1Size?: string; child2Size?: string },
  ) {
    const data = await this.cartService.addItem(user._id.toString(), body);
    return { success: true, message: 'Item added to bag!', data };
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update cart item quantity (+1 / -1)' })
  async updateQuantity(
    @CurrentUser() user: UserDocument,
    @Param('productId') productId: string,
    @Body() body: { size: string; delta: number },
  ) {
    const data = await this.cartService.updateItemQuantity(user._id.toString(), productId, body.size, body.delta);
    return { success: true, message: 'Cart updated', data };
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove product item from cart' })
  async removeItem(
    @CurrentUser() user: UserDocument,
    @Param('productId') productId: string,
    @Body() body: { size: string },
  ) {
    const data = await this.cartService.removeItem(user._id.toString(), productId, body.size);
    return { success: true, message: 'Item removed from cart', data };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all items in cart' })
  async clearCart(@CurrentUser() user: UserDocument) {
    const data = await this.cartService.clearCart(user._id.toString());
    return { success: true, message: 'Cart cleared', data };
  }

  @Post('apply-coupon')
  @ApiOperation({ summary: 'Apply coupon code to cart' })
  async applyCoupon(@CurrentUser() user: UserDocument, @Body() body: { code: string }) {
    const data = await this.cartService.applyCoupon(user._id.toString(), body.code);
    return { success: true, message: `Coupon "${body.code}" applied!`, data };
  }

  @Delete('coupon')
  @ApiOperation({ summary: 'Remove active coupon code from cart' })
  async removeCoupon(@CurrentUser() user: UserDocument) {
    const data = await this.cartService.removeCoupon(user._id.toString());
    return { success: true, message: 'Coupon removed', data };
  }
}

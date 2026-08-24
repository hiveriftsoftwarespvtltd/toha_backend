import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user saved wishlist' })
  async getWishlist(@CurrentUser() user: UserDocument) {
    const data = await this.wishlistService.getWishlist(user._id.toString());
    return { success: true, message: 'Wishlist retrieved', data };
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Toggle add/remove product to wishlist' })
  async toggleWishlist(@CurrentUser() user: UserDocument, @Param('productId') productId: string) {
    const data = await this.wishlistService.toggleWishlist(user._id.toString(), productId);
    return {
      success: true,
      message: `Item ${data.action} wishlist!`,
      data,
    };
  }
}

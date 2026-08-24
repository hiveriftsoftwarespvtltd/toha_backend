import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums';

@ApiTags('Customer Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get approved reviews for a product' })
  async getProductReviews(@Param('productId') productId: string) {
    const data = await this.reviewsService.findProductReviews(productId);
    return { success: true, message: 'Reviews retrieved', data };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: Submit verified purchase review' })
  async createReview(
    @CurrentUser() user: UserDocument,
    @Body() body: { productId: string; rating: number; title?: string; comment: string; images?: string[] },
  ) {
    const data = await this.reviewsService.createReview(user._id.toString(), user.name, body);
    return { success: true, message: 'Thank you! Your review has been submitted.', data };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all reviews for moderation' })
  async getAllAdminReviews() {
    const data = await this.reviewsService.findAllAdminReviews();
    return { success: true, message: 'Reviews retrieved', data };
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Moderate review status (Approved / Rejected)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    const data = await this.reviewsService.updateStatus(id, status);
    return { success: true, message: `Review #${id} marked as ${status}`, data };
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete review' })
  async deleteReview(@Param('id') id: string) {
    await this.reviewsService.deleteReview(id);
    return { success: true, message: 'Review deleted', data: { id } };
  }
}

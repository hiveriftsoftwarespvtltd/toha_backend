import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { Coupon } from './schemas/coupon.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Coupons & Discounts')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active coupons' })
  async getAll() {
    const data = await this.couponsService.findAll();
    return { success: true, message: 'Coupons retrieved', data };
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code against cart total' })
  async validate(@Body() body: { code: string; cartTotal?: number }) {
    const data = await this.couponsService.validateCoupon(body.code, body.cartTotal || 0);
    return { success: true, message: data.message, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create discount coupon' })
  async create(@Body() body: Partial<Coupon>) {
    const data = await this.couponsService.create(body);
    return { success: true, message: `Coupon "${data.code}" created successfully!`, data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update coupon' })
  async update(@Param('id') id: string, @Body() body: Partial<Coupon>) {
    const data = await this.couponsService.update(id, body);
    return { success: true, message: 'Coupon updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete coupon code' })
  async remove(@Param('id') id: string) {
    await this.couponsService.remove(id);
    return { success: true, message: 'Coupon code deleted.', data: { id } };
  }
}

import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Inventory Management')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: Get overall inventory list with stock levels' })
  async getInventory() {
    const data = await this.inventoryService.getInventoryList();
    return { success: true, message: 'Inventory list retrieved', data };
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Admin: Get low stock product alerts' })
  async getLowStock(@Query('threshold') threshold?: number) {
    const data = await this.inventoryService.getLowStockProducts(threshold ? Number(threshold) : 10);
    return { success: true, message: 'Low stock products retrieved', data };
  }

  @Patch(':productId/adjust')
  @ApiOperation({ summary: 'Admin: Adjust stock quantity (+ / -)' })
  async adjustStock(
    @Param('productId') productId: string,
    @Body('adjustment') adjustment: number,
    @Body('reason') reason?: string,
  ) {
    const data = await this.inventoryService.adjustStock(productId, Number(adjustment), reason);
    return {
      success: true,
      message: `Stock updated for Product #${productId}`,
      data: data.product,
    };
  }

  @Get(':productId/logs')
  @ApiOperation({ summary: 'Admin: Get stock adjustment audit logs for a product' })
  async getLogs(@Param('productId') productId: string) {
    const data = await this.inventoryService.getLogsForProduct(productId);
    return { success: true, message: 'Stock adjustment logs retrieved', data };
  }
}

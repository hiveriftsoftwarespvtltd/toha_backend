import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Product Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get catalog products with filtering, search & sorting' })
  async getAllProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('subcategory') subcategory?: string,
    @Query('collectionName') collectionName?: string,
    @Query('brand') brand?: string,
    @Query('ageRange') ageRange?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('isNew') isNew?: boolean,
    @Query('isTrending') isTrending?: boolean,
    @Query('isBestseller') isBestseller?: boolean,
    @Query('isSale') isSale?: boolean,
    @Query('sort') sort?: string,
  ) {
    const result = await this.productsService.findAll({
      page,
      limit,
      search,
      category,
      subcategory,
      collectionName,
      brand,
      ageRange,
      minPrice,
      maxPrice,
      isNew,
      isTrending,
      isBestseller,
      isSale,
      sort,
    });
    return {
      success: true,
      message: 'Products retrieved',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single product details by ID or slug' })
  async getProductById(@Param('id') id: string) {
    const data = await this.productsService.findOne(id);
    return {
      success: true,
      message: 'Product details retrieved',
      data,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new product' })
  async createProduct(@Body() createProductDto: CreateProductDto) {
    const data = await this.productsService.create(createProductDto);
    return {
      success: true,
      message: `Product "${data.name}" added successfully!`,
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update product details' })
  async updateProduct(@Param('id') id: string, @Body() updateFields: Partial<CreateProductDto>) {
    const data = await this.productsService.update(id, updateFields);
    return {
      success: true,
      message: 'Product updated successfully!',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete product' })
  async deleteProduct(@Param('id') id: string) {
    await this.productsService.remove(id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data: { id },
    };
  }

  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Bulk delete products' })
  async bulkDeleteProducts(@Body('ids') ids: string[]) {
    const res = await this.productsService.bulkDelete(ids);
    return {
      success: true,
      message: `Deleted ${res.deletedCount} selected products.`,
      data: res,
    };
  }

  @Post('bulk-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Bulk update sale status' })
  async bulkUpdateStatus(@Body('ids') ids: string[], @Body('status') status: string) {
    const isSale = status === 'Sale';
    const res = await this.productsService.bulkUpdateStatus(ids, isSale);
    return {
      success: true,
      message: `Updated status for ${res.updatedCount} products.`,
      data: res,
    };
  }
}

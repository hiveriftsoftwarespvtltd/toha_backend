import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { Brand } from './schemas/brand.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all brands' })
  async getAll() {
    const data = await this.brandsService.findAll();
    return { success: true, message: 'Brands retrieved', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single brand details' })
  async getOne(@Param('id') id: string) {
    const data = await this.brandsService.findOne(id);
    return { success: true, message: 'Brand retrieved', data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create brand' })
  async create(@Body() body: Partial<Brand>) {
    const data = await this.brandsService.create(body);
    return { success: true, message: 'Brand created', data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update brand' })
  async update(@Param('id') id: string, @Body() body: Partial<Brand>) {
    const data = await this.brandsService.update(id, body);
    return { success: true, message: 'Brand updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete brand' })
  async remove(@Param('id') id: string) {
    await this.brandsService.remove(id);
    return { success: true, message: 'Brand deleted', data: { id } };
  }
}

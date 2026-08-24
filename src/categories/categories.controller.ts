import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Category } from './schemas/category.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  async getAll() {
    const data = await this.categoriesService.findAll();
    return {
      success: true,
      message: 'Categories retrieved',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single category details' })
  async getOne(@Param('id') id: string) {
    const data = await this.categoriesService.findOne(id);
    return {
      success: true,
      message: 'Category retrieved',
      data,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new category' })
  async create(@Body() body: Partial<Category>) {
    const data = await this.categoriesService.create(body);
    return {
      success: true,
      message: `Category "${data.name}" created`,
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update category' })
  async update(@Param('id') id: string, @Body() body: Partial<Category>) {
    const data = await this.categoriesService.update(id, body);
    return {
      success: true,
      message: 'Category updated',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete category' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
    return {
      success: true,
      message: 'Category deleted',
      data: { id },
    };
  }
}

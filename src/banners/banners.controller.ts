import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { Banner } from './schemas/banner.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Promotional Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Get active promotional & hero banners' })
  async getAll() {
    const data = await this.bannersService.findAll();
    return { success: true, message: 'Banners retrieved', data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create promotional banner' })
  async create(@Body() body: Partial<Banner>) {
    const data = await this.bannersService.create(body);
    return { success: true, message: 'Promotional Banner created!', data };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update banner via PUT' })
  async updatePut(@Param('id') id: string, @Body() body: Partial<Banner>) {
    if (!id || id === 'undefined') {
      const data = await this.bannersService.create(body);
      return { success: true, message: 'Promotional Banner created!', data };
    }
    const data = await this.bannersService.update(id, body);
    return { success: true, message: 'Banner updated', data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update banner via PATCH' })
  async updatePatch(@Param('id') id: string, @Body() body: Partial<Banner>) {
    if (!id || id === 'undefined') {
      const data = await this.bannersService.create(body);
      return { success: true, message: 'Promotional Banner created!', data };
    }
    const data = await this.bannersService.update(id, body);
    return { success: true, message: 'Banner updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete banner' })
  async remove(@Param('id') id: string) {
    await this.bannersService.remove(id);
    return { success: true, message: 'Banner removed.', data: { id } };
  }
}

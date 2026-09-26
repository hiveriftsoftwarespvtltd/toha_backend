import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GenderCardsService } from './gender-cards.service';
import { GenderCard } from './schemas/gender-card.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Kids Collection Gender Cards')
@Controller('gender-cards')
export class GenderCardsController {
  constructor(private readonly genderCardsService: GenderCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all kids collection gender cards' })
  async getAll() {
    const data = await this.genderCardsService.findAll();
    return { success: true, message: 'Gender cards retrieved', data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create or update gender card' })
  async create(@Body() body: Partial<GenderCard>) {
    const data = await this.genderCardsService.create(body);
    return { success: true, message: 'Gender card saved successfully', data };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update gender card via PUT' })
  async updatePut(@Param('id') id: string, @Body() body: Partial<GenderCard>) {
    if (!id || id === 'undefined') {
      const data = await this.genderCardsService.create(body);
      return { success: true, message: 'Gender card saved successfully', data };
    }
    const data = await this.genderCardsService.update(id, body);
    return { success: true, message: 'Gender card updated', data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update gender card via PATCH' })
  async updatePatch(@Param('id') id: string, @Body() body: Partial<GenderCard>) {
    if (!id || id === 'undefined') {
      const data = await this.genderCardsService.create(body);
      return { success: true, message: 'Gender card saved successfully', data };
    }
    const data = await this.genderCardsService.update(id, body);
    return { success: true, message: 'Gender card updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete gender card' })
  async remove(@Param('id') id: string) {
    await this.genderCardsService.remove(id);
    return { success: true, message: 'Gender card removed', data: { id } };
  }
}

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { StoreSettings } from './schemas/settings.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Store Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get global store settings' })
  async getSettings() {
    const data = await this.settingsService.getSettings();
    return { success: true, message: 'Settings retrieved', data };
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update store configuration settings' })
  async updateSettings(@Body() body: Partial<StoreSettings>) {
    const data = await this.settingsService.updateSettings(body);
    return { success: true, message: 'Store settings saved successfully!', data };
  }
}

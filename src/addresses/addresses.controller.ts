import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { Address } from './schemas/address.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user addresses' })
  async getAll(@CurrentUser() user: UserDocument) {
    const data = await this.addressesService.findAllByUser(user._id.toString());
    return { success: true, message: 'Addresses retrieved', data };
  }

  @Post()
  @ApiOperation({ summary: 'Add new delivery address' })
  async create(@CurrentUser() user: UserDocument, @Body() body: Partial<Address>) {
    const data = await this.addressesService.create(user._id.toString(), body);
    return { success: true, message: 'New address saved!', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address' })
  async update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() body: Partial<Address>) {
    const data = await this.addressesService.update(user._id.toString(), id, body);
    return { success: true, message: 'Address updated', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete delivery address' })
  async remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    await this.addressesService.remove(user._id.toString(), id);
    return { success: true, message: 'Address removed.', data: { id } };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set default delivery address' })
  async setDefault(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.addressesService.setDefault(user._id.toString(), id);
    return { success: true, message: 'Default delivery address updated.', data };
  }
}

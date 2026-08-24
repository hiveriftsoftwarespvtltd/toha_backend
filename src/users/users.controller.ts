import { Controller, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from './schemas/user.schema';
import { Role } from '../common/enums';

@ApiTags('Users CRM & Profiles')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMyProfile(@CurrentUser() user: UserDocument) {
    return {
      success: true,
      message: 'Profile retrieved',
      data: user,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update customer profile fields' })
  async updateMyProfile(@CurrentUser() user: UserDocument, @Body() body: any) {
    const data = await this.usersService.updateProfile(user._id.toString(), body);
    return {
      success: true,
      message: 'Profile updated successfully!',
      data,
    };
  }

  @Get()
  @Get('customers')
  @ApiOperation({ summary: 'Admin: Get all registered customers with LTV metrics' })
  async getAllCustomers(@Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.usersService.findAllCustomers({ search, page, limit });
    return {
      success: true,
      message: 'Customers retrieved',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Get single customer details' })
  async getCustomerById(@Param('id') id: string) {
    const data = await this.usersService.findOne(id);
    return {
      success: true,
      message: 'Customer details retrieved',
      data,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Delete customer account' })
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: { id },
    };
  }
}

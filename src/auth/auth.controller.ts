import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Customer Signup' })
  async signup(@Body() signupDto: SignupDto) {
    const data = await this.authService.signup(signupDto);
    return {
      success: true,
      message: 'Account created successfully! Welcome to Tohay Kids 🎉',
      data,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Customer Login' })
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto);
    return {
      success: true,
      message: `Welcome back, ${data.user.name}!`,
      data,
    };
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin Portal Login' })
  async adminLogin(@Body() loginDto: LoginDto) {
    const data = await this.authService.adminLogin(loginDto);
    return {
      success: true,
      message: 'Admin authentication successful',
      data,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user session' })
  async getProfile(@CurrentUser() user: UserDocument) {
    return {
      success: true,
      message: 'User session retrieved',
      data: this.authService.sanitizeUser(user),
    };
  }

  @Post('admin/update-credentials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Admin Profile & Credentials (Email/Password/Name)' })
  async updateAdminCredentials(
    @CurrentUser() user: UserDocument,
    @Body() body: { name?: string; email?: string; currentPassword?: string; newPassword?: string }
  ) {
    const data = await this.authService.updateAdminCredentials(user ? user._id.toString() : '', body);
    return {
      success: true,
      message: 'Admin credentials updated successfully!',
      data,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Customer/Admin Logout' })
  async logout() {
    return {
      success: true,
      message: 'Logged out successfully',
      data: null,
    };
  }
}

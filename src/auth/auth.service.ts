import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto) {
    const email = (signupDto.email || '').trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(signupDto.password, salt);

    const createdUser = new this.userModel({
      name: signupDto.name.trim(),
      email,
      passwordHash,
      role: Role.CUSTOMER,
    });

    const savedUser = await createdUser.save();
    const tokens = await this.generateTokens(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const email = (loginDto.email || '').trim().toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email or password. Please check your credentials.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password. Please check your password.');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async adminLogin(loginDto: LoginDto) {
    const email = (loginDto.email || '').trim().toLowerCase();
    const envAdminEmail = (this.configService.get<string>('ADMIN_EMAIL') || 'admin@tohaykids.com').trim().toLowerCase();
    const envAdminPassword = this.configService.get<string>('ADMIN_PASSWORD') || '123456';
    const defaultAdminEmail = 'admin@tohaykids.com';
    const defaultAdminPassword = 'AdminPassword123!';

    let user = await this.userModel.findOne({ email }).exec();

    // Auto-create or repair admin user if using configured admin credentials
    const isEnvAdminAttempt = (email === envAdminEmail && loginDto.password === envAdminPassword);
    const isDefaultAdminAttempt = (email === defaultAdminEmail && (loginDto.password === defaultAdminPassword || loginDto.password === '123456'));

    if ((isEnvAdminAttempt || isDefaultAdminAttempt) && (!user || user.role !== Role.ADMIN || !user.passwordHash)) {
      const passwordHash = await bcrypt.hash(loginDto.password, 10);
      if (!user) {
        user = new this.userModel({
          email,
          passwordHash,
          name: email === envAdminEmail ? 'Admin' : 'Super Admin',
          role: Role.ADMIN,
        });
      } else {
        user.role = Role.ADMIN;
        user.passwordHash = passwordHash;
      }
      await user.save();
    }

    if (!user || user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(loginDto.password, user.passwordHash)
      : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async generateTokens(user: UserDocument) {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const expiresIn = user.role === Role.ADMIN ? '365d' : '30d';
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '365d' });

    return { accessToken, refreshToken };
  }

  sanitizeUser(user: UserDocument) {
    const obj = user.toObject();
    delete obj.passwordHash;
    return obj;
  }
}

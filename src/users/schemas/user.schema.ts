import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/enums';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class KidProfile {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  age: string;

  @Prop({ required: true })
  preferredSize: string;

  @Prop({ required: true })
  gender: string;
}

const KidProfileSchema = SchemaFactory.createForClass(KidProfile);

@Schema({ _id: false })
export class UserNotifications {
  @Prop({ default: true })
  whatsapp: boolean;

  @Prop({ default: true })
  email: boolean;

  @Prop({ default: false })
  sms: boolean;
}

const UserNotificationsSchema = SchemaFactory.createForClass(UserNotifications);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ type: String, enum: Role, default: Role.CUSTOMER, index: true })
  role: Role;

  @Prop({ default: 'Female' })
  gender: string;

  @Prop({ default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80' })
  avatar: string;

  @Prop({ default: 'Gold Member' })
  memberTier: string;

  @Prop({ default: 450 })
  coins: number;

  @Prop({ default: '' })
  referralCode: string;

  @Prop({ type: [KidProfileSchema], default: [] })
  kids: KidProfile[];

  @Prop({ type: UserNotificationsSchema, default: () => ({ whatsapp: true, email: true, sms: false }) })
  notifications: UserNotifications;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

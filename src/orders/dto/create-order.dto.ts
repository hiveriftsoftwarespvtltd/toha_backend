import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  items?: any[];

  @ApiProperty({ example: { flat: 'Flat 402', street: 'Sector 62', city: 'Noida', state: 'UP', pincode: '201301' } })
  @IsNotEmpty()
  shippingAddress: {
    flat: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    name?: string;
    phone?: string;
    email?: string;
  };

  @ApiProperty({ example: 'COD' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  shipping?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  @ApiProperty({ example: 'SUMMER20', required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  razorpayOrderId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  razorpayPaymentId?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class InitiateExpressPayuDto {
  @ApiProperty({ required: false, example: 'TK12345' })
  @IsString()
  @IsOptional()
  order_id?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  items?: any[];

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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  shippingAddress?: {
    name?: string;
    email?: string;
    phone?: string;
    flat?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };

  @ApiProperty({ required: false, example: 'http://localhost:5173' })
  @IsString()
  @IsOptional()
  return_origin?: string;
}

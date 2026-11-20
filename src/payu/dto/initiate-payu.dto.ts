import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InitiatePayuDto {
  @ApiProperty({ example: 'TK12345', description: 'Internal order ID to pay via PayU Hosted Checkout' })
  @IsString()
  @IsNotEmpty()
  order_id: string;

  @ApiProperty({
    example: 'http://localhost:5173',
    required: false,
    description: 'Optional storefront origin (validated against allowlist) for post-payment redirect',
  })
  @IsString()
  @IsOptional()
  return_origin?: string;
}

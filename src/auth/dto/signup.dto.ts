import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'Ananya Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ananya.sharma@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'CustomerPassword123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '+91 98765 43210', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'TH-101', required: false })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'TH-101', required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ example: 'Floral Orange Lehenga Choli With Dupatta' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Girls' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Lehenga Choli', required: false })
  @IsString()
  @IsOptional()
  subcategory?: string;

  @ApiProperty({ example: 'Festive', required: false })
  @IsString()
  @IsOptional()
  collectionName?: string;

  @ApiProperty({ example: 'TH-HERITAGE', required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ example: '0-8', required: false })
  @IsString()
  @IsOptional()
  ageRange?: string;

  @ApiProperty({ example: ['0-2Y', '2-4Y', '4-6Y', '6-8Y'], required: false })
  @IsArray()
  @IsOptional()
  sizes?: string[];

  @ApiProperty({ example: [{ name: 'Orange', hex: '#F97316' }], required: false })
  @IsArray()
  @IsOptional()
  colors?: { name: string; hex: string }[];

  @ApiProperty({ example: 2352, required: false })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({ example: 3299, required: false })
  @IsNumber()
  @IsOptional()
  mrp?: number;

  @ApiProperty({ example: 14, required: false })
  @IsNumber()
  @IsOptional()
  stock?: number;

  @ApiProperty({ example: ['https://images.unsplash.com/photo-1596870230751-ebdfce98ec42'], required: false })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiProperty({ example: 'Vibrant orange floral printed lehenga choli set.', required: false })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiProperty({ example: 'Pure Silk Blend', required: false })
  @IsString()
  @IsOptional()
  fabric?: string;

  @ApiProperty({ example: 'Dry Clean Only', required: false })
  @IsString()
  @IsOptional()
  care?: string;

  @ApiProperty({ example: 'Festive', required: false })
  @IsString()
  @IsOptional()
  occasion?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isNew?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isTrending?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isBestseller?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isSale?: boolean;
}

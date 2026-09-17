import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<ProductDocument>) { }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    subcategory?: string;
    collectionName?: string;
    brand?: string;
    ageRange?: string;
    minPrice?: number;
    maxPrice?: number;
    isNew?: boolean;
    isTrending?: boolean;
    isBestseller?: boolean;
    isSale?: boolean;
    sort?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 100);
    const skip = (page - 1) * limit;

    const filter: any = { isActive: true };

    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { category: new RegExp(query.search, 'i') },
        { subcategory: new RegExp(query.search, 'i') },
        { fabric: new RegExp(query.search, 'i') },
        { shortDescription: new RegExp(query.search, 'i') },
      ];
    }

    if (query.category) {
      filter.category = new RegExp(`^${query.category}$`, 'i');
    }

    if (query.subcategory) {
      filter.subcategory = new RegExp(query.subcategory, 'i');
    }

    if (query.collectionName) {
      filter.collectionName = new RegExp(query.collectionName, 'i');
    }

    if (query.brand) {
      filter.brand = new RegExp(query.brand, 'i');
    }

    if (query.ageRange) {
      filter.ageRange = new RegExp(query.ageRange, 'i');
    }

    if (
      query.minPrice !== undefined &&
      query.minPrice !== null &&
      String(query.minPrice).trim() !== '' &&
      String(query.minPrice) !== 'undefined' &&
      !isNaN(Number(query.minPrice))
    ) {
      const minP = Number(query.minPrice);
      if (!isNaN(minP)) {
        filter.price = filter.price || {};
        filter.price.$gte = minP;
      }
    }

    if (
      query.maxPrice !== undefined &&
      query.maxPrice !== null &&
      String(query.maxPrice).trim() !== '' &&
      String(query.maxPrice) !== 'undefined' &&
      !isNaN(Number(query.maxPrice))
    ) {
      const maxP = Number(query.maxPrice);
      if (!isNaN(maxP)) {
        filter.price = filter.price || {};
        filter.price.$lte = maxP;
      }
    }

    if (query.isNew !== undefined && String(query.isNew) !== 'undefined') filter.isNew = String(query.isNew) === 'true';
    if (query.isTrending !== undefined && String(query.isTrending) !== 'undefined') filter.isTrending = String(query.isTrending) === 'true';
    if (query.isBestseller !== undefined && String(query.isBestseller) !== 'undefined') filter.isBestseller = String(query.isBestseller) === 'true';
    if (query.isSale !== undefined && String(query.isSale) !== 'undefined') filter.isSale = String(query.isSale) === 'true';

    let sortOptions: any = { createdAt: -1 };
    if (query.sort === 'price_asc') sortOptions = { price: 1 };
    if (query.sort === 'price_desc') sortOptions = { price: -1 };
    if (query.sort === 'rating') sortOptions = { rating: -1 };
    if (query.sort === 'newest') sortOptions = { createdAt: -1 };

    const [total, products] = await Promise.all([
      this.productModel.countDocuments(filter).exec(),
      this.productModel.find(filter).sort(sortOptions).allowDiskUse(true).skip(skip).limit(limit).lean().exec(),
    ]);



    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productModel.findOne({ $or: [{ id }, { slug: id }] }).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID/slug "${id}" not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const customId = createProductDto.id || createProductDto.sku || `th-${Date.now().toString().slice(-4)}`;
    const slug = (createProductDto.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const sizeVariants = Array.isArray(createProductDto.sizeVariants) && createProductDto.sizeVariants.length > 0
      ? createProductDto.sizeVariants
      : [];

    let sizes = createProductDto.sizes && createProductDto.sizes.length > 0
      ? createProductDto.sizes
      : (sizeVariants.length > 0 ? sizeVariants.map((v) => v.size) : ['0-2Y', '2-4Y', '4-6Y', '6-8Y']);

    let price = createProductDto.price;
    let mrp = createProductDto.mrp;
    let stock = createProductDto.stock;

    if (sizeVariants.length > 0) {
      // Derive starting price from variants if not set or 0
      const variantPrices = sizeVariants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
      if (!price && variantPrices.length > 0) {
        price = Math.min(...variantPrices);
      }
      const variantMrps = sizeVariants.map((v) => Number(v.mrp)).filter((m) => !isNaN(m) && m > 0);
      if (!mrp && variantMrps.length > 0) {
        mrp = Math.min(...variantMrps);
      }
      const totalVariantStock = sizeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      if (stock === undefined || stock === null) {
        stock = totalVariantStock;
      }
    }

    const newProduct = new this.productModel({
      id: customId,
      slug,
      ageRange: createProductDto.ageRange || '0-8',
      sizes,
      sizeVariants,
      colors: createProductDto.colors && createProductDto.colors.length > 0 ? createProductDto.colors : [{ name: 'Multicolor', hex: '#FF0066' }],
      stock: stock ?? 10,
      price: price ?? 999,
      mrp: mrp ?? 1499,
      images: createProductDto.images && createProductDto.images.length > 0 ? createProductDto.images : ['https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?auto=format&fit=crop&w=800&q=80'],
      rating: 4.8,
      reviewsCount: 1,
      isActive: true,
      ...createProductDto,
    });

    return await newProduct.save();
  }

  async update(id: string, updateFields: Partial<CreateProductDto>) {
    const fieldsToUpdate: any = { ...updateFields };

    if (Array.isArray(updateFields.sizeVariants) && updateFields.sizeVariants.length > 0) {
      const sizeVariants = updateFields.sizeVariants;
      fieldsToUpdate.sizes = Array.from(new Set([
        ...(updateFields.sizes || []),
        ...sizeVariants.map((v) => v.size),
      ]));

      const variantPrices = sizeVariants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
      if ((!fieldsToUpdate.price || fieldsToUpdate.price === 0) && variantPrices.length > 0) {
        fieldsToUpdate.price = Math.min(...variantPrices);
      }
    }

    const product = await this.productModel.findOneAndUpdate({ id }, fieldsToUpdate, { new: true }).exec();
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async remove(id: string) {
    const product = await this.productModel.findOneAndDelete({ id }).exec();
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return { id };
  }

  async bulkDelete(ids: string[]) {
    await this.productModel.deleteMany({ id: { $in: ids } }).exec();
    return { deletedCount: ids.length };
  }

  async bulkUpdateStatus(ids: string[], isSale: boolean) {
    await this.productModel.updateMany({ id: { $in: ids } }, { $set: { isSale } }).exec();
    return { updatedCount: ids.length };
  }
}

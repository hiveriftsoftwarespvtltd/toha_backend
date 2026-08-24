import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private categoryModel: Model<CategoryDocument>) { }

  async findAll() {
    const list = await this.categoryModel.find().sort({ sortOrder: 1, createdAt: -1 }).lean().exec();
    const hasOldSeed = list.some((c) => c.name && c.name.includes('Girls Ethnicwear'));

    if (list.length === 0 || hasOldSeed) {
      const defaults = [
        {
          id: 'cat-boys',
          name: 'Boys Collection',
          slug: 'boys',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=600&q=80',
          description: 'Smart ethnic wear for boys',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 1
        },
        {
          id: 'cat-girls',
          name: 'Girls Collection',
          slug: 'girls',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?auto=format&fit=crop&w=600&q=80',
          description: 'Festive lehengas and gowns for girls',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 2
        },
        {
          id: 'cat-siblings',
          name: 'Siblings Matching',
          slug: 'siblings',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=600&q=80',
          description: 'Coordinated outfits for brothers & sisters',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 3
        },
        {
          id: 'cat-age',
          name: 'Shop By Age',
          slug: 'shop-by-age',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80',
          description: 'Explore outfits by age group',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 4
        },
        {
          id: 'cat-new',
          name: 'New Arrivals',
          slug: 'new-arrivals',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=600&q=80',
          description: 'Fresh festive additions',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 5
        },
        {
          id: 'cat-collections',
          name: 'Collections',
          slug: 'collections',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?auto=format&fit=crop&w=600&q=80',
          description: 'Festive & Wedding Special Edits',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 6
        },
        {
          id: 'cat-sale',
          name: 'Sale',
          slug: 'sale',
          parentCategory: 'Main',
          image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=600&q=80',
          description: 'Exclusive discounts & festive deals',
          subcategories: [],
          productsCount: 0,
          status: 'Active',
          sortOrder: 7
        }
      ];
      for (const d of defaults) {
        await this.categoryModel.findOneAndUpdate({ id: d.id }, d, { upsert: true, new: true }).exec();
      }
      await this.categoryModel.deleteMany({ name: { $regex: /Girls Ethnicwear|Boys Festive Kurtas|Shop By Age \(0 to 16/i } }).exec();
      return await this.categoryModel.find().sort({ sortOrder: 1, createdAt: -1 }).lean().exec();
    }
    return list;
  }


  async findOne(id: string) {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async create(data: Partial<Category>) {
    const id = data.id || `cat-${Date.now()}`;
    const slug = data.slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'category');
    const newCategory = new this.categoryModel({
      id,
      slug,
      status: 'Active',
      productsCount: 0,
      subcategories: [],
      ...data,
    });
    return await newCategory.save();
  }

  async update(id: string, fields: Partial<Category>) {
    const updated = await this.categoryModel.findOneAndUpdate({ id }, fields, { new: true }).exec();
    if (!updated) {
      const created = await this.create({ id, ...fields });
      return created;
    }
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.categoryModel.findOneAndDelete({ id }).exec();
    if (!deleted) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return { id };
  }
}

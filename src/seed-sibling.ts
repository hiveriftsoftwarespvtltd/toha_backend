import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './products/schemas/product.schema';
import { Category, CategoryDocument } from './categories/schemas/category.schema';

const productIdsToCopy = [
  'TH-5654',
  'TH-4936',
  'TH-9739',
  'TH-2596',
  'TH-9353',
  'TH-3215',
  'TH-7763',
  'TH-3470',
  'TH-2699',
];

async function seedSiblingProducts() {
  console.log('🚀 Starting Sibling Products Batch Seed Script...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
  const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));

  const newSubcategories = new Set<string>();
  const clonedProducts: any[] = [];

  for (const originalId of productIdsToCopy) {
    // 1. Fetch original product
    const original = await productModel.findOne({ id: originalId }).lean().exec();

    if (!original) {
      console.warn(`⚠️ Original product ${originalId} not found in database!`);
      continue;
    }

    const siblingProductId = `${original.id}-SIB`;
    const baseSlug = (original.slug || original.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/-sibling$/, '');
    const siblingSlug = `${baseSlug}-sibling`;

    const siblingProductData: any = {
      ...original,
      id: siblingProductId,
      name: original.name,
      slug: siblingSlug,
      category: 'Siblings Matching',
      subcategory: original.subcategory || 'Matching Sets',
      isSiblingSet: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    delete siblingProductData._id;
    delete siblingProductData.__v;

    // 2. Upsert into MongoDB
    const saved = await productModel.findOneAndUpdate(
      { id: siblingProductId },
      siblingProductData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (saved.subcategory) {
      newSubcategories.add(saved.subcategory);
    }

    clonedProducts.push(saved);
    console.log(`✅ Seeded: ${saved.name} [${saved.id}] -> Siblings Matching / ${saved.subcategory}`);
  }

  // 3. Ensure Siblings Matching category contains all subcategories
  const siblingCat = await categoryModel.findOne({
    $or: [{ id: 'cat-siblings' }, { slug: 'siblings' }, { name: 'Siblings Matching' }]
  }).exec();

  if (siblingCat) {
    const existingSubs = Array.isArray(siblingCat.subcategories) ? siblingCat.subcategories : [];
    let updated = false;

    newSubcategories.forEach((sub) => {
      if (sub && !existingSubs.includes(sub)) {
        existingSubs.push(sub);
        updated = true;
      }
    });

    if (updated) {
      siblingCat.subcategories = existingSubs;
      await siblingCat.save();
      console.log(`✅ Updated Siblings Matching subcategories:`, existingSubs);
    }
  }

  console.log(`\n🎉 Successfully cloned ${clonedProducts.length} products into Siblings Matching category!`);
  await app.close();
}

seedSiblingProducts().catch((err) => {
  console.error('❌ Error seeding sibling products:', err);
  process.exit(1);
});

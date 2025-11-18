import dotenv from 'dotenv';
import { connectDatabase } from '../database';
import { CategoryModel } from '../models/Category';
import logger from '../utils/logger';

dotenv.config();

// Function to generate slug from name (matches resolver logic)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Categories to seed (excluding 1-11 and Electronics which are already created)
const categoriesToSeed = [
  {
    name: 'Vacuum Cleaners',
    description: 'Eco-friendly vacuum cleaners and sustainable cleaning equipment',
  },
  {
    name: 'Clothing',
    description: 'Sustainable and organic clothing made from eco-friendly materials',
  },
  {
    name: 'Shoes & Footwear',
    description: 'Eco-friendly shoes and sustainable footwear from ethical brands',
  },
  {
    name: 'Accessories',
    description: 'Sustainable fashion accessories made from recycled and organic materials',
  },
  {
    name: 'Bags & Luggage',
    description: 'Eco-friendly bags, backpacks, and luggage from sustainable materials',
  },
  {
    name: 'Skincare',
    description: 'Natural and organic skincare products free from harmful chemicals',
  },
  {
    name: 'Hair Care',
    description: 'Sustainable hair care products with natural and organic ingredients',
  },
  {
    name: 'Personal Care',
    description: 'Eco-friendly personal care essentials for daily wellness',
  },
  {
    name: 'Furniture',
    description: 'Sustainable and recycled furniture made from eco-friendly materials',
  },
  {
    name: 'Home Decor',
    description: 'Eco-friendly home decoration items and sustainable interior design',
  },
  {
    name: 'Bedding & Linens',
    description: 'Organic and sustainable bedding made from natural fibers',
  },
  {
    name: 'Kitchenware',
    description: 'Sustainable kitchen tools and cookware from eco-friendly materials',
  },
  {
    name: 'Organic Food',
    description: 'Certified organic food products grown without pesticides',
  },
  {
    name: 'Beverages',
    description: 'Organic and sustainable beverages including teas, coffees, and juices',
  },
  {
    name: 'Snacks',
    description: 'Healthy and organic snacks made from natural ingredients',
  },
  {
    name: 'Supplements',
    description: 'Natural health supplements from organic and sustainable sources',
  },
  {
    name: 'Fitness Equipment',
    description: 'Sustainable fitness and exercise equipment made from recycled materials',
  },
  {
    name: 'Yoga & Meditation',
    description: 'Eco-friendly yoga mats and meditation accessories for mindful living',
  },
  {
    name: 'Baby Products',
    description: 'Organic and safe baby products free from harmful chemicals',
  },
  {
    name: 'Kids Toys',
    description: 'Sustainable and educational toys made from eco-friendly materials',
  },
  {
    name: 'Outdoor Gear',
    description: 'Eco-friendly outdoor and camping equipment for nature enthusiasts',
  },
  {
    name: 'Sports Equipment',
    description: 'Sustainable sports and athletic gear made from recycled materials',
  },
  {
    name: 'Pet Supplies',
    description: 'Eco-friendly pet food and accessories for your sustainable pet care',
  },
  {
    name: 'Office Supplies',
    description: 'Sustainable office and stationery products made from recycled materials',
  },
  {
    name: 'Books',
    description: 'Eco-friendly books and educational materials from sustainable publishers',
  },
  {
    name: 'Car Accessories',
    description: 'Sustainable automotive accessories and eco-friendly car products',
  },
  {
    name: 'Recycled Products',
    description: 'Products made from recycled materials across all categories',
  },
  {
    name: 'Certified Organic',
    description: 'Certified organic products verified for sustainability and quality',
  },
];

async function seedCategories() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    let createdCount = 0;
    let skippedCount = 0;

    // Create categories
    for (const categoryData of categoriesToSeed) {
      const slug = generateSlug(categoryData.name);

      // Check if category already exists
      const existingCategory = await CategoryModel.findOne({ slug }).exec();

      if (existingCategory) {
        logger.warn(`Category "${categoryData.name}" (${slug}) already exists, skipping...`);
        skippedCount++;
        continue;
      }

      // Create new category
      const category = new CategoryModel({
        name: categoryData.name,
        slug,
        description: categoryData.description,
      });

      await category.save();
      logger.info(`✅ Created category: ${categoryData.name} (${slug})`);
      createdCount++;
    }

    logger.info('\n📊 Seeding Summary:');
    logger.info(`   ✅ Created: ${createdCount} categories`);
    logger.info(`   ⏭️  Skipped: ${skippedCount} categories (already exist)`);
    logger.info(`   📦 Total: ${categoriesToSeed.length} categories processed`);

    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to seed categories', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run the seed function
seedCategories();


import { CategoryModel } from '../models/Category';
import { ProductModel } from '../models/Product';
import { UserModel, UserRole } from '../models/User';

// Helper function to check if user is admin
async function isAdmin(user: any): Promise<boolean> {
  if (!user || !user.userId) return false;
  const dbUser = await UserModel.findById(user.userId).exec();
  return dbUser?.role === UserRole.ADMIN;
}

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export const categoryResolvers: any = {
  Query: {
    // Public endpoint - no authentication required
    categories: async () => {
      return await CategoryModel.find().exec();
    },
    // Public endpoint - no authentication required
    category: async (_: any, { id }: { id: string }) => {
      return await CategoryModel.findById(id).exec();
    },
    // Public endpoint - no authentication required
    categoryBySlug: async (_: any, { slug }: { slug: string }) => {
      return await CategoryModel.findOne({ slug }).exec();
    },
  },
  Mutation: {
    createCategory: async (_: any, { input }: { input: any }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      if (!(await isAdmin(user))) {
        throw new Error('Only admins can create categories');
      }

      // Generate slug if not provided
      const slug = input.slug || generateSlug(input.name);

      // Check if category with same slug already exists
      const existingCategory = await CategoryModel.findOne({ slug }).exec();
      if (existingCategory) {
        throw new Error('Category with this slug already exists');
      }

      const category = new CategoryModel({
        name: input.name,
        slug,
        description: input.description,
      });

      return await category.save();
    },
    updateCategory: async (_: any, { id, input }: { id: string; input: any }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      if (!(await isAdmin(user))) {
        throw new Error('Only admins can update categories');
      }

      const category = await CategoryModel.findById(id).exec();
      if (!category) {
        throw new Error('Category not found');
      }

      const updateData: any = {};
      
      if (input.name) {
        updateData.name = input.name;
      }
      
      if (input.slug) {
        // Check if slug is already taken by another category
        const existingCategory = await CategoryModel.findOne({ 
          slug: input.slug,
          _id: { $ne: id }
        }).exec();
        if (existingCategory) {
          throw new Error('Category with this slug already exists');
        }
        updateData.slug = input.slug;
      } else if (input.name && !input.slug) {
        // Auto-generate slug if name changed but slug didn't
        updateData.slug = generateSlug(input.name);
      }
      
      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      return await CategoryModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    },
    deleteCategory: async (_: any, { id }: { id: string }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      if (!(await isAdmin(user))) {
        throw new Error('Only admins can delete categories');
      }

      const category = await CategoryModel.findById(id).exec();
      if (!category) {
        throw new Error('Category not found');
      }

      // Check if category has products
      const productsCount = await ProductModel.countDocuments({ category: id }).exec();
      if (productsCount > 0) {
        throw new Error(`Cannot delete category. It has ${productsCount} product(s) associated with it.`);
      }

      await CategoryModel.findByIdAndDelete(id).exec();
      return true;
    },
  },
  Category: {
    products: async (category: any) => {
      return await ProductModel.find({ category: category.id }).exec();
    },
  },
};


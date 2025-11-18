import dotenv from 'dotenv';
import { connectDatabase } from '../database';
import { UserModel, UserRole } from '../models/User';
import logger from '../utils/logger';

dotenv.config();

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ecoswift.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

async function seedAdmin() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ 
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      role: UserRole.ADMIN 
    }).exec();

    if (existingAdmin) {
      logger.warn(`Admin user with email ${DEFAULT_ADMIN_EMAIL} already exists`);
      logger.info('Skipping admin creation');
      process.exit(0);
    }

    // Create admin user
    logger.info('Creating admin user...');
    const admin = new UserModel({
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      password: DEFAULT_ADMIN_PASSWORD, // Will be hashed by pre-save hook
      role: UserRole.ADMIN,
    });

    await admin.save();

    logger.info('✅ Admin user created successfully!');
    logger.info(`   Email: ${DEFAULT_ADMIN_EMAIL}`);
    logger.info(`   Password: ${DEFAULT_ADMIN_PASSWORD}`);
    logger.info('   ⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to seed admin user', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run the seed function
seedAdmin();


import mongoose from 'mongoose';
import logger from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eco-swift';
    
    if (!process.env.MONGODB_URI) {
      logger.warn('MONGODB_URI not set, using default localhost connection');
    }
    
    // Set connection options for better reliability
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    });
    
    logger.info('Connected to MongoDB', { 
      hasCustomUri: !!process.env.MONGODB_URI,
      uriPrefix: mongoUri.substring(0, 20) + '...',
    });
  } catch (error: any) {
    logger.error('MongoDB connection error', { 
      error: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack,
    });
    throw new Error(`Failed to connect to MongoDB: ${error?.message || 'Unknown error'}`);
  }
};


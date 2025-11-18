import mongoose from 'mongoose';
import logger from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eco-swift';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB', { uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eco-swift' });
  } catch (error) {
    logger.error('MongoDB connection error', { error });
    throw error;
  }
};


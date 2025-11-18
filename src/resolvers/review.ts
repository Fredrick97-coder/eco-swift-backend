import { ReviewModel } from '../models/Review';
import { ProductModel } from '../models/Product';
import { OrderModel } from '../models/Order';

export const reviewResolvers: any = {
  Query: {
    reviews: async (_: any, { productId, userId, limit = 10, offset = 0 }: { productId?: string; userId?: string; limit?: number; offset?: number }, { user }: { user: any }) => {
      const query: any = {};
      
      if (productId) {
        query.product = productId;
      }
      
      if (userId) {
        query.user = userId;
      }
      
      return await ReviewModel.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 })
        .populate('product')
        .populate('user')
        .populate('order')
        .exec();
    },
    
    review: async (_: any, { id }: { id: string }) => {
      return await ReviewModel.findById(id)
        .populate('product')
        .populate('user')
        .populate('order')
        .exec();
    },
  },
  
  Mutation: {
    createReview: async (_: any, { input }: { input: any }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      // Validate rating
      if (input.rating < 1 || input.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      // Verify the order exists and belongs to the user
      const order = await OrderModel.findById(input.orderId)
        .populate('customer')
        .exec();
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      const customerId = (order.customer as any)?._id?.toString() || (order.customer as any)?.toString();
      if (customerId !== user.userId) {
        throw new Error('You can only review products from your own orders');
      }
      
      // Verify order is delivered
      if (order.status !== 'DELIVERED') {
        throw new Error('You can only review products from delivered orders');
      }
      
      // Verify the product is in the order
      // Order items have product as ObjectId, so we compare directly
      const productInOrder = order.items.some((item: any) => {
        const itemProductId = item.product?.toString();
        return itemProductId === input.productId;
      });
      
      if (!productInOrder) {
        throw new Error('Product not found in this order');
      }
      
      // Check if review already exists for this order and product
      const existingReview = await ReviewModel.findOne({
        product: input.productId,
        user: user.userId,
        order: input.orderId,
      }).exec();
      
      if (existingReview) {
        throw new Error('You have already reviewed this product for this order');
      }
      
      // Create review
      const review = new ReviewModel({
        product: input.productId,
        user: user.userId,
        order: input.orderId,
        rating: input.rating,
        comment: input.comment,
      });
      
      const savedReview = await review.save();
      
      // Update product rating and review count
      await updateProductRating(input.productId);
      
      // Populate and return
      return await ReviewModel.findById(savedReview._id)
        .populate('product')
        .populate('user')
        .populate('order')
        .exec();
    },
    
    updateReview: async (_: any, { id, rating, comment }: { id: string; rating?: number; comment?: string }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const review = await ReviewModel.findById(id).exec();
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      if (review.user.toString() !== user.userId) {
        throw new Error('You can only update your own reviews');
      }
      
      if (rating !== undefined) {
        if (rating < 1 || rating > 5) {
          throw new Error('Rating must be between 1 and 5');
        }
        review.rating = rating;
      }
      
      if (comment !== undefined) {
        review.comment = comment;
      }
      
      const updatedReview = await review.save();
      
      // Update product rating
      await updateProductRating(review.product.toString());
      
      return await ReviewModel.findById(updatedReview._id)
        .populate('product')
        .populate('user')
        .populate('order')
        .exec();
    },
    
    deleteReview: async (_: any, { id }: { id: string }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const review = await ReviewModel.findById(id).exec();
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      if (review.user.toString() !== user.userId) {
        throw new Error('You can only delete your own reviews');
      }
      
      const productId = review.product.toString();
      await review.deleteOne();
      
      // Update product rating
      await updateProductRating(productId);
      
      return true;
    },
  },
};

// Helper function to update product rating and review count
async function updateProductRating(productId: string) {
  const reviews = await ReviewModel.find({ product: productId }).exec();
  
  if (reviews.length === 0) {
    await ProductModel.findByIdAndUpdate(productId, {
      rating: 0,
      reviewCount: 0,
    }).exec();
    return;
  }
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;
  
  await ProductModel.findByIdAndUpdate(productId, {
    rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    reviewCount: reviews.length,
  }).exec();
}


import { productResolvers } from './product';
import { userResolvers } from './user';
import { categoryResolvers } from './category';
import { orderResolvers } from './order';
import { reviewResolvers } from './review';
import { subscriptionResolvers } from './subscription';
import { dateScalar, jsonScalar } from './scalars';

// Helper function to merge resolver objects properly
function mergeResolvers(...resolverObjects: any[]): any {
  const merged: any = {
    Date: dateScalar,
    JSON: jsonScalar,
    Query: {},
    Mutation: {},
    Subscription: {},
  };

  // Merge all resolver objects
  for (const resolvers of resolverObjects) {
    if (resolvers.Query) {
      Object.assign(merged.Query, resolvers.Query);
    }
    if (resolvers.Mutation) {
      Object.assign(merged.Mutation, resolvers.Mutation);
    }
    if (resolvers.Subscription) {
      Object.assign(merged.Subscription, resolvers.Subscription);
    }
    // Merge other top-level properties (like User, Product, etc.)
    for (const key in resolvers) {
      if (key !== 'Query' && key !== 'Mutation' && key !== 'Subscription' && key !== 'Date' && key !== 'JSON') {
        merged[key] = { ...merged[key], ...resolvers[key] };
      }
    }
  }

  return merged;
}

export const resolvers = mergeResolvers(
  productResolvers,
  userResolvers,
  categoryResolvers,
  orderResolvers,
  reviewResolvers,
  subscriptionResolvers
);


import { PubSub } from 'graphql-subscriptions';
import { ProductModel } from '../models/Product';
import { UserModel } from '../models/User';

// Create a PubSub instance for managing subscriptions
export const pubsub = new PubSub();

// Subscription event names
export const SUBSCRIPTION_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  NOTIFICATION_ADDED: 'NOTIFICATION_ADDED',
};

export const subscriptionResolvers: any = {
  Subscription: {
    orderCreated: {
      subscribe: (_: any, { vendorId, customerId }: { vendorId?: string; customerId?: string }, { user }: any) => {
        const channels = [SUBSCRIPTION_EVENTS.ORDER_CREATED];
        
        // If vendorId is provided, subscribe to vendor-specific channel
        if (vendorId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_CREATED}_${vendorId}`);
        }
        
        // If user is a vendor, subscribe to their channel
        if (user?.userId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_CREATED}_${user.userId}`);
        }
        
        // If customerId is provided, subscribe to customer-specific channel
        if (customerId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_CREATED}_${customerId}`);
        }
        
        return pubsub.asyncIterableIterator(channels);
      },
    },
    orderUpdated: {
      subscribe: (_: any, { orderId }: { orderId?: string }) => {
        const channel = orderId
          ? `${SUBSCRIPTION_EVENTS.ORDER_UPDATED}_${orderId}`
          : SUBSCRIPTION_EVENTS.ORDER_UPDATED;
        return pubsub.asyncIterableIterator([channel]);
      },
    },
    orderStatusChanged: {
      subscribe: (_: any, { vendorId, customerId }: { vendorId?: string; customerId?: string }, { user }: any) => {
        const channels: string[] = [];
        
        // If vendorId is provided, subscribe to vendor-specific channel
        if (vendorId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${vendorId}`);
        }
        
        // If user is a vendor, subscribe to their channel
        if (user?.userId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${user.userId}`);
        }
        
        // If customerId is provided, subscribe to customer-specific channel
        if (customerId) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${customerId}`);
        }
        
        // If user is authenticated, subscribe to their channel (for both vendors and customers)
        if (user?.userId && channels.length === 0) {
          channels.push(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${user.userId}`);
        }
        
        if (channels.length === 0) {
          throw new Error('Vendor ID or Customer ID required');
        }
        
        return pubsub.asyncIterableIterator(channels);
      },
    },
    productCreated: {
      subscribe: (_: any, { vendorId }: { vendorId?: string }, { user }: any) => {
        // If vendorId is explicitly provided, subscribe to that vendor's channel
        if (vendorId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_CREATED}_${vendorId}`,
          ]);
        }
        // If user is a vendor and no vendorId specified, subscribe to their channel
        if (user?.userId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_CREATED}_${user.userId}`,
            SUBSCRIPTION_EVENTS.PRODUCT_CREATED, // Also listen to general channel
          ]);
        }
        // For public/unauthenticated subscriptions, listen to general channel
        return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.PRODUCT_CREATED]);
      },
    },
    productUpdated: {
      subscribe: (_: any, { vendorId }: { vendorId?: string }, { user }: any) => {
        // If vendorId is explicitly provided, subscribe to that vendor's channel
        if (vendorId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_UPDATED}_${vendorId}`,
          ]);
        }
        // If user is a vendor and no vendorId specified, subscribe to their channel
        if (user?.userId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_UPDATED}_${user.userId}`,
            SUBSCRIPTION_EVENTS.PRODUCT_UPDATED, // Also listen to general channel
          ]);
        }
        // For public/unauthenticated subscriptions, listen to general channel
        return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.PRODUCT_UPDATED]);
      },
    },
    productDeleted: {
      subscribe: (_: any, { vendorId }: { vendorId?: string }, { user }: any) => {
        // If vendorId is explicitly provided, subscribe to that vendor's channel
        if (vendorId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_DELETED}_${vendorId}`,
          ]);
        }
        // If user is a vendor and no vendorId specified, subscribe to their channel
        if (user?.userId) {
          return pubsub.asyncIterableIterator([
            `${SUBSCRIPTION_EVENTS.PRODUCT_DELETED}_${user.userId}`,
            SUBSCRIPTION_EVENTS.PRODUCT_DELETED, // Also listen to general channel
          ]);
        }
        // For public/unauthenticated subscriptions, listen to general channel
        return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.PRODUCT_DELETED]);
      },
    },
    notificationAdded: {
      subscribe: (_: any, { userId }: { userId?: string }, { user }: any) => {
        // Users can only subscribe to their own notifications
        const targetUserId = userId || user?.userId;
        if (!targetUserId) {
          throw new Error('User ID required');
        }
        return pubsub.asyncIterableIterator([
          `${SUBSCRIPTION_EVENTS.NOTIFICATION_ADDED}_${targetUserId}`,
        ]);
      },
    },
  },
};


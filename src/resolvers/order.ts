import { OrderModel, OrderStatus } from '../models/Order';
import { ProductModel } from '../models/Product';
import { pubsub, SUBSCRIPTION_EVENTS } from './subscription';

export const orderResolvers: any = {
  Query: {
    orders: async (_: any, { vendorId, customerId, status, limit = 10, offset = 0 }: { vendorId?: string; customerId?: string; status?: string; limit?: number; offset?: number }, { user }: { user: any }) => {
      const query: any = {};

      // If vendorId is provided, filter orders that contain products from that vendor
      if (vendorId) {
        // First, get all products from this vendor
        const vendorProducts = await ProductModel.find({ vendor: vendorId }).select('_id').exec();
        const productIds = vendorProducts.map(p => p._id);
        
        // Find orders that have items with these products
        query['items.product'] = { $in: productIds };
      }

      // If customerId is provided, filter by customer
      if (customerId) {
        query.customer = customerId;
      }

      // If status is provided, filter by status
      if (status) {
        query.status = status;
      }

      return await OrderModel.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 })
        .populate('customer')
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();
    },

    order: async (_: any, { id }: { id: string }) => {
      return await OrderModel.findById(id)
        .populate('customer')
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();
    },

    myOrders: async (_: any, { status, limit = 10, offset = 0 }: { status?: string; limit?: number; offset?: number }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const query: any = { customer: user.userId };

      if (status) {
        query.status = status;
      }

      return await OrderModel.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 })
        .populate('customer')
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();
    },
  },

  Mutation: {
    createOrder: async (_: any, { input }: { input: any }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Validate that all products exist and get their vendor IDs
      const productIds = input.items.map((item: any) => item.productId);
      const products = await ProductModel.find({ 
        _id: { $in: productIds.map((id: string) => id) } 
      })
        .populate('vendor')
        .exec();

      if (products.length !== productIds.length) {
        throw new Error('One or more products not found');
      }

      // Check stock availability
      for (const item of input.items) {
        const product = products.find(p => {
          const productId = p._id?.toString();
          const itemId = String(item.productId);
          return productId === itemId;
        });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      }

      // Create order items with product references
      const orderItems = input.items.map((item: any) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
      }));

      // Calculate total
      const total = input.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

      // Create order
      const order = new OrderModel({
        customer: user.userId,
        items: orderItems,
        total,
        status: OrderStatus.PENDING,
        shippingAddress: input.shippingAddress,
      });

      const savedOrder = await order.save();

      // Update product stock
      for (const item of input.items) {
        await ProductModel.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } }
        ).exec();
      }

      // Populate the order before returning
      const populatedOrder = await OrderModel.findById(savedOrder._id)
        .populate('customer')
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();

      // Publish subscription event for general order created
      pubsub.publish(SUBSCRIPTION_EVENTS.ORDER_CREATED, {
        orderCreated: populatedOrder,
      });

      // Publish to vendor-specific channels for each vendor
      const vendorIds = new Set<string>();
      for (const product of products) {
        const vendorId = (product.vendor as any)?._id?.toString() || (product.vendor as any)?.toString();
        if (vendorId) {
          vendorIds.add(vendorId);
        }
      }

      for (const vendorId of vendorIds) {
        pubsub.publish(`${SUBSCRIPTION_EVENTS.ORDER_CREATED}_${vendorId}`, {
          orderCreated: populatedOrder,
        });

        pubsub.publish(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${vendorId}`, {
          orderStatusChanged: {
            orderId: populatedOrder!.id,
            orderNumber: populatedOrder!.orderNumber,
            oldStatus: OrderStatus.PENDING,
            newStatus: OrderStatus.PENDING,
            updatedAt: populatedOrder!.createdAt,
          },
        });
      }

      // Publish to customer-specific channel
      pubsub.publish(`${SUBSCRIPTION_EVENTS.ORDER_CREATED}_${user.userId}`, {
        orderCreated: populatedOrder,
      });

      return populatedOrder;
    },

    updateOrderStatus: async (_: any, { id, status }: { id: string; status: string }, { user }: { user: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const order = await OrderModel.findById(id)
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();

      if (!order) {
        throw new Error('Order not found');
      }

      // Check if user is the vendor of any product in the order
      const products = order.items.map((item: any) => item.product);
      const isVendor = products.some((product: any) => {
        const vendorId = product.vendor?._id?.toString() || product.vendor?.toString();
        return vendorId === user.userId;
      });

      // Check if user is the customer
      const isCustomer = order.customer.toString() === user.userId;

      if (!isVendor && !isCustomer) {
        throw new Error('Not authorized to update this order');
      }

      const oldStatus = order.status;
      order.status = status as OrderStatus;
      const updatedOrder = await order.save();

      const populatedOrder = await OrderModel.findById(updatedOrder._id)
        .populate('customer')
        .populate({
          path: 'items.product',
          populate: [
            {
              path: 'vendor'
            },
            {
              path: 'category'
            }
          ]
        })
        .exec();

      // Publish subscription event
      pubsub.publish(SUBSCRIPTION_EVENTS.ORDER_UPDATED, {
        orderUpdated: populatedOrder,
      });

      // Publish status change to vendor-specific channels
      const vendorIds = new Set<string>();
      for (const product of products) {
        const vendorId = (product as any).vendor?._id?.toString() || (product as any).vendor?.toString();
        if (vendorId) {
          vendorIds.add(vendorId);
        }
      }

      for (const vendorId of vendorIds) {
        pubsub.publish(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${vendorId}`, {
          orderStatusChanged: {
            orderId: populatedOrder!.id,
            orderNumber: populatedOrder!.orderNumber,
            oldStatus,
            newStatus: status,
            updatedAt: populatedOrder!.updatedAt,
          },
        });
      }

      // Publish to customer
      pubsub.publish(`${SUBSCRIPTION_EVENTS.ORDER_STATUS_CHANGED}_${order.customer.toString()}`, {
        orderStatusChanged: {
          orderId: populatedOrder!.id,
          orderNumber: populatedOrder!.orderNumber,
          oldStatus,
          newStatus: status,
          updatedAt: populatedOrder!.updatedAt,
        },
      });

      return populatedOrder;
    },
  },
};


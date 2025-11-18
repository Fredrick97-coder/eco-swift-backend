import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface IOrder extends Document {
  orderNumber: string;
  customer: mongoose.Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: OrderStatus;
  shippingAddress: IAddress;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    size: { type: String },
    color: { type: String },
  },
  { _id: true }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, unique: true, sparse: true }, // Make it optional initially, will be set by pre-save hook
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [OrderItemSchema],
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    shippingAddress: { type: AddressSchema, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        // Transform order items
        if (ret.items) {
          ret.items = ret.items.map((item: any) => {
            if (item._id) {
              item.id = item._id.toString();
              delete item._id;
            }
            return item;
          });
        }
        return ret;
      },
    },
  }
);

// Generate unique order number before saving
OrderSchema.pre('save', async function (next) {
  // Only generate if orderNumber is not already set
  if (this.orderNumber) {
    return next();
  }
  
  try {
    // Generate order number: ORD-YYYYMMDD-XXXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    let orderNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure uniqueness by checking existing orders
    while (!isUnique && attempts < maxAttempts) {
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      orderNumber = `ORD-${dateStr}-${randomStr}`;
      
      // Check if this order number already exists
      const existing = await mongoose.models.Order?.findOne({ orderNumber }).exec();
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      // Fallback: use timestamp + random if we can't find unique after max attempts
      orderNumber = `ORD-${dateStr}-${Date.now().toString(36).toUpperCase()}`;
    }
    
    this.orderNumber = orderNumber!;
    next();
  } catch (error: any) {
    next(error);
  }
});

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);


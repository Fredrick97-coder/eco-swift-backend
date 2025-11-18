import mongoose, { Schema, Document } from 'mongoose';

export interface IProductColor {
  name: string;
  value: string; // Hex color code
}

export interface IProduct extends Document {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency: string; // Currency code (USD, EUR, GBP, GHS, NGN, ZAR)
  images: string[];
  category: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  stock: number;
  sku: string;
  sizes: string[];
  colors: IProductColor[];
  badge?: string;
  rating?: number;
  reviewCount: number;
  features: string[];
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductColorSchema = new Schema<IProductColor>(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    currency: { type: String, required: true, default: 'USD', enum: ['USD', 'EUR', 'GBP', 'GHS', 'NGN', 'ZAR'] },
    images: [{ type: String }],
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stock: { type: Number, required: true, default: 0 },
    sku: { type: String, required: true, unique: true },
    sizes: [{ type: String }],
    colors: [ProductColorSchema],
    badge: { type: String },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    features: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);


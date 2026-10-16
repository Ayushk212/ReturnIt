import { Schema, model, Document, Types } from 'mongoose';
import { ItemCategory, ItemStatus, ItemType } from '@returnit/shared';

export interface IItemImage {
  url: string;
  publicId: string;
  alt: string;
  width: number;
  height: number;
}

export interface IItemLocation {
  label: string;
  geo: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  radiusMeters: number;
}

export interface IItem extends Document {
  _id: Types.ObjectId;
  type: ItemType;
  title: string;
  description: string;
  category: ItemCategory;
  images: IItemImage[];
  location: IItemLocation;
  dateOccurred: Date;
  status: ItemStatus;
  owner: Types.ObjectId;
  verificationQuestion?: string;
  verificationAnswerHash?: string;
  tags: string[];
  idempotencyKey?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ItemImageSchema = new Schema<IItemImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const ItemLocationSchema = new Schema<IItemLocation>(
  {
    label: { type: String, required: true, trim: true },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    radiusMeters: { type: Number, default: 500 },
  },
  { _id: false },
);

const ItemSchema = new Schema<IItem>(
  {
    type: { type: String, enum: Object.values(ItemType), required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, enum: Object.values(ItemCategory), required: true, index: true },
    images: { type: [ItemImageSchema], default: [] },
    location: { type: ItemLocationSchema, required: true },
    dateOccurred: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ItemStatus),
      default: ItemStatus.OPEN,
      index: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    verificationQuestion: { type: String, trim: true, maxlength: 300 },
    verificationAnswerHash: { type: String, select: false }, // Never returned by default
    tags: { type: [String], default: [] },
    idempotencyKey: { type: String, sparse: true, index: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days default
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ItemSchema.index(
  {
    title: 'text',
    description: 'text',
    tags: 'text',
    'location.label': 'text',
  },
  {
    weights: {
      title: 10,
      tags: 5,
      description: 3,
      'location.label': 2,
    },
    name: 'ItemTextIndex',
  },
);

ItemSchema.index({ type: 1, status: 1, category: 1, dateOccurred: -1 });
ItemSchema.index({ 'location.geo': '2dsphere' });
ItemSchema.index({ owner: 1, createdAt: -1 });
ItemSchema.index({ status: 1, expiresAt: 1 });

export const Item = model<IItem>('Item', ItemSchema);

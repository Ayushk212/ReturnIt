import { Schema, model, Document, Types } from 'mongoose';
import { ClaimStatus } from '@returnit/shared';
import { IItemImage } from './Item.js';

export interface IClaimAuditEntry {
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
  actor: Types.ObjectId;
  at: Date;
  note?: string;
}

export interface IClaim extends Document {
  _id: Types.ObjectId;
  item: Types.ObjectId;
  claimant: Types.ObjectId;
  answers: string;
  proofImages: IItemImage[];
  status: ClaimStatus;
  decidedAt?: Date;
  decisionNote?: string;
  auditTrail: IClaimAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const ClaimAuditEntrySchema = new Schema<IClaimAuditEntry>(
  {
    fromStatus: { type: String, enum: Object.values(ClaimStatus), required: true },
    toStatus: { type: String, enum: Object.values(ClaimStatus), required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const ClaimImageSchema = new Schema<IItemImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const ClaimSchema = new Schema<IClaim>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    claimant: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    proofImages: { type: [ClaimImageSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ClaimStatus),
      default: ClaimStatus.PENDING,
      index: true,
    },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, maxlength: 500 },
    auditTrail: { type: [ClaimAuditEntrySchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// One active (pending) claim per item per claimant
ClaimSchema.index(
  { item: 1, claimant: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ClaimStatus.PENDING },
  },
);

ClaimSchema.index({ claimant: 1, createdAt: -1 });
ClaimSchema.index({ item: 1, status: 1 });

export const Claim = model<IClaim>('Claim', ClaimSchema);

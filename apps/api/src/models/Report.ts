import { Schema, model, Document, Types } from 'mongoose';
import { ReportReason, ReportStatus, ReportTargetType } from '@returnit/shared';

export interface IReport extends Document {
  _id: Types.ObjectId;
  reporter: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: Object.values(ReportTargetType), required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, enum: Object.values(ReportReason), required: true },
    details: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    resolutionNote: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

ReportSchema.index({ targetType: 1, targetId: 1, status: 1 });
ReportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Report = model<IReport>('Report', ReportSchema);

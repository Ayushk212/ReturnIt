import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, UserStatus } from '@returnit/shared';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, select: false }, // Never selected by default
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    avatarUrl: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true,
    },
    trustScore: { type: Number, default: 10, min: 0, max: 100 },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ status: 1, role: 1 });

export const User = model<IUser>('User', UserSchema);

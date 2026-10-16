import { z } from 'zod';
import {
  ChangePasswordSchema,
  CreateClaimSchema,
  CreateConversationSchema,
  CreateItemSchema,
  CreateReportSchema,
  DecideClaimSchema,
  ItemImageSchema,
  LocationSchema,
  LoginSchema,
  QueryItemsSchema,
  RegisterSchema,
  SendMessageSchema,
  SignedUploadParamsSchema,
  UpdateItemSchema,
  UpdateProfileSchema,
} from './schemas.js';

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export type ItemImage = z.infer<typeof ItemImageSchema>;
export type ItemLocation = z.infer<typeof LocationSchema>;
export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type QueryItemsInput = z.infer<typeof QueryItemsSchema>;

export type CreateClaimInput = z.infer<typeof CreateClaimSchema>;
export type DecideClaimInput = z.infer<typeof DecideClaimSchema>;

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type SignedUploadParamsInput = z.infer<typeof SignedUploadParamsSchema>;

// Unified Error Response Contract
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// User Public Profile Projection
export interface PublicUserProfile {
  _id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  trustScore: number;
  createdAt: string;
  listingsCount?: number;
  resolvedCount?: number;
}

// Authenticated User Payload
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

// Pagination Result
export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

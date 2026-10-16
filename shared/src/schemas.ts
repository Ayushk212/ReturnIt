import { z } from 'zod';
import {
  ItemCategory,
  ItemSortOption,
  ItemStatus,
  ItemType,
  ReportReason,
  ReportTargetType,
} from './enums.js';

// GeoJSON Point Schema
export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

export const LocationSchema = z.object({
  label: z.string().min(2).max(200),
  geo: GeoPointSchema,
  radiusMeters: z.number().min(0).max(100000).default(500),
});

export const ItemImageSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1).max(200),
  alt: z.string().min(1).max(200),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Authentication Schemas
export const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters'),
  phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format').optional(),
  bio: z.string().trim().max(500).optional(),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters'),
});

// User Schemas
export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format').optional(),
});

// Item Schemas
export const CreateItemSchema = z
  .object({
    type: z.enum([ItemType.LOST, ItemType.FOUND]),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    category: z.nativeEnum(ItemCategory),
    images: z.array(ItemImageSchema).max(5).default([]),
    location: LocationSchema,
    dateOccurred: z
      .string()
      .datetime({ offset: true })
      .or(z.date())
      .refine(
        (val) => new Date(val).getTime() <= Date.now() + 60000,
        'dateOccurred cannot be in the future',
      ),
    verificationQuestion: z.string().trim().max(300).optional(),
    verificationAnswer: z.string().trim().max(300).optional(),
    tags: z.array(z.string().trim().toLowerCase().max(30)).max(10).default([]),
    idempotencyKey: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.type === ItemType.FOUND && data.verificationQuestion) {
        return !!data.verificationAnswer;
      }
      return true;
    },
    {
      message: 'verificationAnswer is required when verificationQuestion is set for found items',
      path: ['verificationAnswer'],
    },
  );

export const UpdateItemSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  category: z.nativeEnum(ItemCategory).optional(),
  images: z.array(ItemImageSchema).max(5).optional(),
  location: LocationSchema.optional(),
  status: z
    .enum([ItemStatus.OPEN, ItemStatus.CLAIM_PENDING, ItemStatus.RESOLVED, ItemStatus.REMOVED])
    .optional(),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(10).optional(),
});

export const QueryItemsSchema = z.object({
  type: z.enum([ItemType.LOST, ItemType.FOUND]).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.nativeEnum(ItemCategory).optional(),
  location: z.string().trim().max(200).optional(),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'near must be lat,lng format')
    .optional(),
  radiusKm: z.coerce.number().min(0.1).max(500).default(50).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  status: z.nativeEnum(ItemStatus).optional().default(ItemStatus.OPEN),
  sort: z.nativeEnum(ItemSortOption).default(ItemSortOption.NEWEST),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Claim Schemas
export const CreateClaimSchema = z.object({
  answers: z.string().trim().min(10).max(2000),
  proofImages: z.array(ItemImageSchema).max(3).default([]),
});

export const DecideClaimSchema = z.object({
  action: z.enum(['approve', 'reject']),
  decisionNote: z.string().trim().max(500).optional(),
});

// Chat Schemas
export const CreateConversationSchema = z.object({
  itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid item ID format'),
  participantId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
});

export const SendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  clientMessageId: z.string().uuid(),
});

// Report Schemas
export const CreateReportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid target ID format'),
  reason: z.nativeEnum(ReportReason),
  details: z.string().trim().min(10).max(1000),
});

// Upload Schemas
export const SignedUploadParamsSchema = z.object({
  folder: z.string().regex(/^[a-zA-Z0-9_\-/]+$/),
});

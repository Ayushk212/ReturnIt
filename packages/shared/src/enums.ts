export const UserRole = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ItemType = {
  LOST: 'lost',
  FOUND: 'found',
} as const;
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ItemCategory = {
  ELECTRONICS: 'electronics',
  DOCUMENTS: 'documents',
  WALLETS_BAGS: 'wallets-bags',
  KEYS: 'keys',
  JEWELRY: 'jewelry',
  CLOTHING: 'clothing',
  PETS: 'pets',
  OTHER: 'other',
} as const;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export const ItemStatus = {
  OPEN: 'open',
  CLAIM_PENDING: 'claim_pending',
  RESOLVED: 'resolved',
  EXPIRED: 'expired',
  REMOVED: 'removed',
} as const;
export type ItemStatus = (typeof ItemStatus)[keyof typeof ItemStatus];

export const ClaimStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const ReportTargetType = {
  ITEM: 'item',
  USER: 'user',
  CLAIM: 'claim',
  CONVERSATION: 'conversation',
} as const;
export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];

export const ReportReason = {
  SPAM: 'spam',
  FAKE_CLAIM: 'fake_claim',
  HARASSMENT: 'harassment',
  PROHIBITED_ITEM: 'prohibited_item',
  INAPPROPRIATE_CONTENT: 'inappropriate_content',
  OTHER: 'other',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  DISMISSED: 'dismissed',
  RESOLVED: 'resolved',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ItemSortOption = {
  NEWEST: 'newest',
  NEAREST: 'nearest',
  RELEVANCE: 'relevance',
} as const;
export type ItemSortOption = (typeof ItemSortOption)[keyof typeof ItemSortOption];

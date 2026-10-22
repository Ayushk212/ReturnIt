export type ItemType = 'lost' | 'found';
export type ItemStatus = 'open' | 'claim_pending' | 'resolved' | 'expired' | 'removed';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface ItemImage {
  url: string;
  /** Smaller rendition for cards and thumbnails. */
  thumbUrl?: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PersonRef {
  id?: string;
  name: string;
  avatarUrl?: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  category: string;
  locationLabel: string;
  dateOccurred: string;
  createdAt: string;
  expiresAt?: string;
  status: ItemStatus;
  images: ItemImage[];
  owner: PersonRef;
  isOwner: boolean;
  saved: boolean;
  verificationQuestion?: string;
  myClaimStatus?: ClaimStatus;
}

export interface Claim {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  direction: 'sent' | 'received';
  counterpartId?: string;
  counterpartName: string;
  message: string;
  status: ClaimStatus;
  createdAt: string;
  contact?: { name: string; email: string };
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}

export interface AcademicInfo {
  programme: string | null;
  academicYear: string | null;
  branch: string | null;
  section: string | null;
  summary: string;
}

export interface ListingStats {
  lost: number;
  found: number;
  resolved: number;
  active: number;
}

export interface MyProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl?: string;
  hasUploadedAvatar: boolean;
  academic: AcademicInfo;
  onboarded: boolean;
  createdAt: string;
  stats?: ListingStats;
}

export interface PublicProfile {
  id: string;
  name: string;
  bio: string;
  avatarUrl?: string;
  academic: AcademicInfo;
  createdAt: string;
  stats: ListingStats;
}

export interface OnboardingInput {
  name: string;
  programme: string;
  academicYear: string;
  branch: string;
  section: string;
  about: string;
}

export interface ProfileUpdate {
  name?: string;
  programme?: string;
  academicYear?: string;
  branch?: string;
  section?: string;
  bio?: string;
}

export interface Conversation {
  id: string;
  item: { id: string; title: string; type: ItemType; status: ItemStatus; thumbUrl?: string; isMine: boolean };
  counterpart: PersonRef & { id: string };
  lastMessage?: { content: string; fromMe: boolean; createdAt: string };
  unreadCount: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  fromMe: boolean;
  content: string;
  clientMessageId: string;
  /** For my own messages: whether the other person has read it. */
  read: boolean;
  createdAt: string;
}

export interface NavSummary {
  unreadMessages: number;
  pendingRequests: number;
}

export type ReportReason = 'spam' | 'fake_claim' | 'prohibited_item' | 'inappropriate_content' | 'harassment' | 'other';

export interface ItemFilters {
  type?: ItemType;
  category?: string;
  q?: string;
  location?: string;
  status?: 'active' | 'resolved';
}

export interface NewItemInput {
  type: ItemType;
  title: string;
  description: string;
  category: string;
  locationLabel: string;
  dateOccurred: string;
  verificationQuestion?: string;
  verificationAnswer?: string;
  images: File[];
  idempotencyKey: string;
}

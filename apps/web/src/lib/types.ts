export type ItemType = 'lost' | 'found';
export type ItemStatus = 'open' | 'claim_pending' | 'resolved' | 'expired';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface ItemImage {
  url: string;
  alt: string;
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
  status: ItemStatus;
  images: ItemImage[];
  owner: { name: string };
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

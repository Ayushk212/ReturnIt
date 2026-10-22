import type { Item } from './types';

export type StoredItem = Item & { ownerId: string };

const HOUR = 3_600_000;
const ago = (hours: number): string => new Date(Date.now() - hours * HOUR).toISOString();

interface Seed {
  id: string;
  type: Item['type'];
  title: string;
  description: string;
  category: string;
  locationLabel: string;
  status: Item['status'];
  postedHoursAgo: number;
  occurredHoursAgo: number;
  ownerName: string;
  question?: string;
}

function build(s: Seed): StoredItem {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    category: s.category,
    locationLabel: s.locationLabel,
    status: s.status,
    dateOccurred: ago(s.occurredHoursAgo),
    createdAt: ago(s.postedHoursAgo),
    images: [],
    owner: { id: `seed-${s.id}`, name: s.ownerName },
    ownerId: `seed-${s.id}`,
    isOwner: false,
    saved: false,
    verificationQuestion: s.question,
  };
}

export function seedItems(): StoredItem[] {
  return [
    build({ id: 's1', type: 'found', title: 'Black leather wallet', description: 'Plain black wallet with a few cards inside. Found on a reading table near the window.', category: 'wallets-bags', locationLabel: 'Central Library', status: 'open', postedHoursAgo: 3, occurredHoursAgo: 4, ownerName: 'Riya S.', question: 'Which department is printed on the ID card inside?' }),
    build({ id: 's2', type: 'lost', title: 'Grey laptop charger (65W, USB-C)', description: 'Lost after the evening lab session. Has a small strip of blue tape wrapped around the cable.', category: 'electronics', locationLabel: 'Computer Science Dept.', status: 'open', postedHoursAgo: 9, occurredHoursAgo: 12, ownerName: 'Aman K.' }),
    build({ id: 's3', type: 'found', title: 'Bunch of keys with a red tag', description: 'Four keys on a ring with a red fabric tag. Left on the steps outside the lecture halls.', category: 'keys', locationLabel: 'Lecture Hall Complex', status: 'open', postedHoursAgo: 20, occurredHoursAgo: 22, ownerName: 'Neha P.', question: 'What is written on the tag?' }),
    build({ id: 's4', type: 'lost', title: 'Casio scientific calculator', description: 'fx-991 with my initials scratched on the back. Needed for the upcoming test.', category: 'electronics', locationLabel: 'Main Building', status: 'open', postedHoursAgo: 30, occurredHoursAgo: 32, ownerName: 'Karan M.' }),
    build({ id: 's5', type: 'found', title: 'Navy blue hoodie', description: 'Size M, no brand label visible. Found hanging on a chair after the evening event.', category: 'clothing', locationLabel: 'Student Activity Centre', status: 'open', postedHoursAgo: 50, occurredHoursAgo: 52, ownerName: 'Ishita R.', question: 'What is in the left pocket?' }),
    build({ id: 's6', type: 'lost', title: 'Silver wristwatch with leather strap', description: 'Round dial, brown strap. Slipped off somewhere between the sports complex and the hostel road.', category: 'jewelry', locationLabel: 'Sports Complex', status: 'open', postedHoursAgo: 70, occurredHoursAgo: 74, ownerName: 'Vivek T.' }),
    build({ id: 's7', type: 'found', title: 'Wired earphones in a pouch', description: 'White earphones in a small zip pouch. Found on a bench near the canteen.', category: 'electronics', locationLabel: 'Canteen / Mess', status: 'claim_pending', postedHoursAgo: 96, occurredHoursAgo: 98, ownerName: 'Sana A.', question: 'What colour is the pouch zip?' }),
    build({ id: 's8', type: 'lost', title: 'Data Structures notebook (blue cover)', description: 'Handwritten notes, name written inside the first page. Last seen after the morning lecture.', category: 'books', locationLabel: 'Lecture Hall Complex', status: 'open', postedHoursAgo: 120, occurredHoursAgo: 124, ownerName: 'Pranav D.' }),
    build({ id: 's9', type: 'found', title: 'Student ID card', description: 'ID card found near the entrance. Handed over after verification.', category: 'documents', locationLabel: 'Main Gate / Bus Stop', status: 'resolved', postedHoursAgo: 200, occurredHoursAgo: 202, ownerName: 'Meera J.' }),
    build({ id: 's10', type: 'lost', title: 'Black umbrella with wooden handle', description: 'Returned to the owner by a finder from the next hostel.', category: 'other', locationLabel: "Boys' Hostels", status: 'resolved', postedHoursAgo: 260, occurredHoursAgo: 264, ownerName: 'Dev S.' }),
  ];
}

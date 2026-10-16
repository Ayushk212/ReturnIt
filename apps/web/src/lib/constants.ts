export const CAMPUS_EMAIL_DOMAIN = 'mnnit.ac.in';

export function isCampusEmail(email: string): boolean {
  return /^[^\s@]+@mnnit\.ac\.in$/.test(email.trim().toLowerCase());
}

export const CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'documents', label: 'ID cards & documents' },
  { value: 'wallets-bags', label: 'Wallets & bags' },
  { value: 'keys', label: 'Keys' },
  { value: 'jewelry', label: 'Jewellery & watches' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'books', label: 'Books & stationery' },
  { value: 'other', label: 'Other' },
] as const;

// Edit this list to match the real campus. The first word(s) are used for filtering.
export const LOCATIONS = [
  'Central Library',
  'Main Building',
  'Student Activity Centre',
  'Lecture Hall Complex',
  'Computer Science Dept.',
  'Electrical Dept.',
  'Mechanical Dept.',
  'Civil Dept.',
  'Sports Complex',
  'Canteen / Mess',
  "Boys' Hostels",
  "Girls' Hostels",
  'Health Centre',
  'Main Gate / Bus Stop',
  'Other on campus',
] as const;

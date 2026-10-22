import { z } from 'zod';

/** Academic details collected once during onboarding and shown on public profiles. */
export const PROGRAMMES = ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'M.Sc', 'Ph.D', 'Faculty', 'Staff'] as const;

export const ACADEMIC_YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Alumni', 'Not applicable'] as const;

export const BRANCHES = [
  'Biotechnology',
  'Chemical Engineering',
  'Civil Engineering',
  'Computer Science and Engineering',
  'Electrical Engineering',
  'Electronics and Communication Engineering',
  'Information Technology',
  'Mechanical Engineering',
  'Production and Industrial Engineering',
  'Management Studies',
  'Computer Applications',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Other',
] as const;

export const SECTION_PATTERN = /^[A-Za-z0-9-]{1,6}$/;

export const OnboardingSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  programme: z.enum(PROGRAMMES),
  academicYear: z.enum(ACADEMIC_YEARS),
  branch: z.enum(BRANCHES),
  section: z
    .string()
    .trim()
    .max(6)
    .refine((v) => v === '' || SECTION_PATTERN.test(v), 'Use up to 6 letters or digits, for example "B" or "G2"')
    .optional()
    .default(''),
  about: z.string().trim().max(280).optional().default(''),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const UpdateMyProfileSchema = OnboardingSchema.partial();
export type UpdateMyProfileInput = z.infer<typeof UpdateMyProfileSchema>;

export interface AcademicProfile {
  programme?: string | null;
  academicYear?: string | null;
  branch?: string | null;
  section?: string | null;
}

/** One presentable line, e.g. "B.Tech · 3rd year · Computer Science and Engineering · Section B". */
export function formatAcademicLine(p: AcademicProfile): string {
  const parts = [p.programme, p.academicYear && p.academicYear !== 'Not applicable' ? p.academicYear : null, p.branch && p.branch !== 'Other' ? p.branch : null];
  if (p.section) parts.push(`Section ${p.section.toUpperCase()}`);
  return parts.filter(Boolean).join(' · ');
}

/** A readable bio sentence from onboarding answers, e.g. "3rd-year B.Tech student in Civil Engineering, Section B." */
export function composeBio(input: { programme: string; academicYear: string; branch: string; section?: string; about?: string }): string {
  const branch = input.branch === 'Other' ? '' : input.branch;
  const section = input.section ? `, Section ${input.section.toUpperCase()}` : '';
  let line: string;
  if (input.programme === 'Faculty' || input.programme === 'Staff') {
    line = `${input.programme === 'Faculty' ? 'Faculty member' : 'Staff member'}${branch ? `, ${branch}` : ''}.`;
  } else if (input.academicYear === 'Alumni') {
    line = `${input.programme} graduate${branch ? `, ${branch}` : ''}.`;
  } else if (input.academicYear === 'Not applicable') {
    line = `${input.programme}${branch ? ` in ${branch}` : ''}${section}.`;
  } else {
    line = `${input.academicYear.replace(' year', '-year')} ${input.programme} student${branch ? ` in ${branch}` : ''}${section}.`;
  }
  const about = input.about?.trim();
  return about ? `${line} ${about}` : line;
}

export const MessageContentSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Messages are limited to 2,000 characters'),
  clientMessageId: z.string().uuid(),
});

export const ReportListingSchema = z.object({
  reason: z.enum(['spam', 'fake_claim', 'prohibited_item', 'inappropriate_content', 'harassment', 'other']),
  details: z.string().trim().min(10, 'Add a few details (at least 10 characters)').max(1000),
});

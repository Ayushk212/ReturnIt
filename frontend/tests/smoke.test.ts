import { describe, it, expect } from 'vitest';
import { isCampusEmail } from '../src/lib/constants';

describe('Web Campus Email Validator', () => {
  it('validates @mnnit.ac.in emails correctly', () => {
    expect(isCampusEmail('student@mnnit.ac.in')).toBe(true);
    expect(isCampusEmail('faculty@mnnit.ac.in')).toBe(true);
    expect(isCampusEmail('attacker@mnnit.ac.in.evil.com')).toBe(false);
    expect(isCampusEmail('user@gmail.com')).toBe(false);
  });
});

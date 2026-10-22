import { createAuthClient } from '@neondatabase/neon-js/auth';

/**
 * Neon Auth (Managed Better Auth) client. The SDK handles the Google OAuth return
 * (`?neon_auth_session_verifier=`), session caching across tabs, and exposes a short-lived
 * JWT as `session.token`, which the API verifies against Neon's public keys.
 */
export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL ?? '';

export const authClient = NEON_AUTH_URL ? createAuthClient(NEON_AUTH_URL) : null;

export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Turns SDK errors into sentences suitable for the sign-in form. */
export function authErrorMessage(err: AuthErrorLike | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  const code = (err?.code ?? '').toUpperCase();
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_CREDENTIALS':
    case 'INVALID_PASSWORD':
    case 'USER_NOT_FOUND':
      return 'Incorrect email or password.';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'An account with this email already exists. Sign in instead.';
    case 'PASSWORD_TOO_SHORT':
      return 'Choose a longer password (at least 10 characters).';
    case 'PASSWORD_TOO_LONG':
      return 'That password is too long.';
    case 'INVALID_OTP':
      return 'That code is not correct. Check the latest email and try again.';
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'TOO_MANY_ATTEMPTS':
      return 'Too many attempts. Request a new code.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Please verify your email address to continue.';
  }
  if (err?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return err?.message && !/^HTTP \d+/.test(err.message) ? err.message : fallback;
}

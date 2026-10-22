import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, USE_MOCK } from '../lib/api';
import { authClient, authErrorMessage } from '../lib/authClient';
import { CAMPUS_EMAIL_DOMAIN, isCampusEmail } from '../lib/constants';
import { session } from '../lib/session';
import type { AuthUser, MyProfile } from '../lib/types';

const DEMO_KEY = 'returnit.demo.user';
const DOMAIN_MESSAGE = `Please use your @${CAMPUS_EMAIL_DOMAIN} account.`;
const UNAVAILABLE_MESSAGE = 'Sign-in is not configured for this environment. Set VITE_NEON_AUTH_URL to enable it.';

export type SignInResult = 'signed-in' | 'verify-email';

interface AuthContextValue {
  user: AuthUser | null;
  /** Application profile (academic details, photo, onboarding state). */
  profile: MyProfile | null;
  loading: boolean;
  available: boolean;
  /** Local demo sign-in for VITE_USE_MOCK builds; never used with the real API. */
  demoMode: boolean;
  /** Email address that signed in but still needs to confirm its verification code. */
  pendingVerification: string | null;
  /** Problems detected outside a form submission, e.g. a non-campus Google account. */
  authError: string | null;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
  setProfile: (p: MyProfile) => void;
  signInWithGoogle: (returnTo: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  register: (name: string, email: string, password: string) => Promise<SignInResult>;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
}

function toAuthUser(u: SessionUser): AuthUser {
  const email = u.email.trim().toLowerCase();
  return { uid: u.id, email, name: u.name?.trim() || email.split('@')[0] || 'Member', photoURL: u.image ?? undefined };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const mounted = useRef(true);

  const applyUser = useCallback((next: AuthUser | null) => {
    session.user = next;
    setUser(next);
    if (!next) setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session.user) return;
    try {
      const p = await api.getMe();
      if (mounted.current) setProfile(p);
    } catch (e) {
      // A rejected token means the session is no longer valid for the API.
      if (e instanceof Error && 'status' in e && (e as { status: number }).status === 401) applyUser(null);
    }
  }, [applyUser]);

  /** Reads the Neon session (this also completes a Google redirect) and applies campus rules. */
  const syncSession = useCallback(
    async (force = false) => {
      if (!authClient) return;
      const res = await authClient.getSession(force ? { fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } } : undefined);
      const sessionUser = res.data?.user as SessionUser | undefined;
      if (!sessionUser) {
        applyUser(null);
        return;
      }
      if (!isCampusEmail(sessionUser.email)) {
        await authClient.signOut();
        applyUser(null);
        setAuthError(`${sessionUser.email} is not a campus account. ${DOMAIN_MESSAGE}`);
        return;
      }
      if (!sessionUser.emailVerified) {
        applyUser(null);
        setPendingVerification(sessionUser.email.toLowerCase());
        return;
      }
      setPendingVerification(null);
      applyUser(toAuthUser(sessionUser));
    },
    [applyUser],
  );

  useEffect(() => {
    mounted.current = true;
    if (USE_MOCK) {
      session.getToken = async () => null;
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) applyUser(JSON.parse(raw) as AuthUser);
      } catch {
        /* ignore a corrupted demo session */
      }
      setLoading(false);
      return () => {
        mounted.current = false;
      };
    }

    session.getToken = async (forceRefresh = false) => {
      if (!authClient) return null;
      const res = await authClient.getSession(forceRefresh ? { fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } } : undefined);
      return res.data?.session?.token ?? null;
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setAuthError('Google sign-in did not complete. Please try again.');

    syncSession()
      .catch(() => applyUser(null))
      .finally(() => mounted.current && setLoading(false));

    // Re-check when the tab regains focus (sign-out in another tab, expired sessions).
    const onFocus = () => void syncSession().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [applyUser, syncSession]);

  useEffect(() => {
    if (user) void refreshProfile();
  }, [user, refreshProfile]);

  const requireClient = () => {
    if (!authClient) throw new Error(UNAVAILABLE_MESSAGE);
    return authClient;
  };

  const demoSignIn = useCallback(
    (email: string, name?: string): SignInResult => {
      const clean = email.trim().toLowerCase();
      const next: AuthUser = { uid: `demo-${clean}`, email: clean, name: name?.trim() || clean.split('@')[0] || 'Member' };
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      applyUser(next);
      return 'signed-in';
    },
    [applyUser],
  );

  const signInWithGoogle = useCallback(async (returnTo: string) => {
    if (USE_MOCK) throw new Error('Google sign-in is not available in demo mode. Use the email form instead.');
    const client = requireClient();
    const origin = window.location.origin;
    const target = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
    const res = await client.signIn.social({
      provider: 'google',
      callbackURL: `${origin}${target}`,
      errorCallbackURL: `${origin}/signin?error=oauth`,
    });
    if (res.error) throw new Error(authErrorMessage(res.error, 'Google sign-in could not start. Please try again.'));
    // On success the browser is redirected to Google; the session is completed on return.
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const clean = email.trim().toLowerCase();
      if (!isCampusEmail(clean)) throw new Error(DOMAIN_MESSAGE);
      if (USE_MOCK) return demoSignIn(clean);
      const res = await requireClient().signIn.email({ email: clean, password });
      if (res.error) {
        if ((res.error.code ?? '').toUpperCase() === 'EMAIL_NOT_VERIFIED') {
          setPendingVerification(clean);
          return 'verify-email';
        }
        throw new Error(authErrorMessage(res.error, 'Sign-in failed. Please try again.'));
      }
      await syncSession(true);
      return session.user ? 'signed-in' : 'verify-email';
    },
    [demoSignIn, syncSession],
  );

  const sendVerificationCode = useCallback(async (email: string) => {
    if (USE_MOCK) return;
    const res = await requireClient().emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: 'email-verification' });
    if (res.error) throw new Error(authErrorMessage(res.error, 'Could not send the code. Please try again.'));
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<SignInResult> => {
      const clean = email.trim().toLowerCase();
      if (!isCampusEmail(clean)) throw new Error(DOMAIN_MESSAGE);
      if (password.length < 10) throw new Error('Choose a password of at least 10 characters.');
      if (USE_MOCK) return demoSignIn(clean, name);
      const res = await requireClient().signUp.email({ email: clean, password, name: name.trim() });
      if (res.error) throw new Error(authErrorMessage(res.error, 'Could not create your account. Please try again.'));
      setPendingVerification(clean);
      await sendVerificationCode(clean);
      return 'verify-email';
    },
    [demoSignIn, sendVerificationCode],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const res = await requireClient().emailOtp.verifyEmail({ email: email.trim().toLowerCase(), otp: code.trim() });
      if (res.error) throw new Error(authErrorMessage(res.error, 'That code could not be verified.'));
      await syncSession(true);
      if (!session.user) throw new Error('Your email is verified. Please sign in to continue.');
    },
    [syncSession],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!isCampusEmail(clean)) throw new Error(DOMAIN_MESSAGE);
    if (USE_MOCK) return;
    const res = await requireClient().emailOtp.requestPasswordReset({ email: clean });
    if (res.error) throw new Error(authErrorMessage(res.error, 'Could not send the reset code. Please try again.'));
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    if (password.length < 10) throw new Error('Choose a password of at least 10 characters.');
    const res = await requireClient().emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: code.trim(), password });
    if (res.error) throw new Error(authErrorMessage(res.error, 'Could not reset your password.'));
  }, []);

  const signOut = useCallback(async () => {
    if (USE_MOCK) {
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        /* ignore */
      }
    } else if (authClient) {
      await authClient.signOut().catch(() => undefined);
    }
    setPendingVerification(null);
    applyUser(null);
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      available: USE_MOCK || Boolean(authClient),
      demoMode: USE_MOCK,
      pendingVerification,
      authError,
      clearAuthError: () => setAuthError(null),
      refreshProfile,
      setProfile,
      signInWithGoogle,
      signInWithEmail,
      register,
      sendVerificationCode,
      verifyEmail,
      requestPasswordReset,
      resetPassword,
      signOut,
    }),
    [user, profile, loading, pendingVerification, authError, refreshProfile, signInWithGoogle, signInWithEmail, register, sendVerificationCode, verifyEmail, requestPasswordReset, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

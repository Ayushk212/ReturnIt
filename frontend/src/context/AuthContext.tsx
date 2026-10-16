import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, firebaseEnabled } from '../lib/firebase';
import { CAMPUS_EMAIL_DOMAIN, isCampusEmail } from '../lib/constants';
import { session } from '../lib/session';
import type { AuthUser } from '../lib/types';

const DEV_KEY = 'returnit.dev.user';
const devMode = !firebaseEnabled && import.meta.env.DEV;

const DOMAIN_MESSAGE = `Please use your @${CAMPUS_EMAIL_DOMAIN} account.`;
const UNVERIFIED_MESSAGE = 'Please verify your email address first. Check your inbox for the verification link.';
const UNAVAILABLE_MESSAGE = 'Sign-in is not available right now. Please try again later.';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  available: boolean;
  devMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resendVerification: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(fb: FirebaseUser): AuthUser {
  const email = fb.email ?? '';
  return {
    uid: fb.uid,
    name: fb.displayName?.trim() || email.split('@')[0] || 'Member',
    email,
    photoURL: fb.photoURL ?? undefined,
  };
}

function messageFor(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 10 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return e instanceof Error && !code ? e.message : 'Sign-in failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // While true, an explicit flow (register / email sign-in) applies the result itself.
  const handlingFlow = useRef(false);

  const apply = useCallback((next: AuthUser | null) => {
    session.user = next;
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    session.getToken = async () => (auth?.currentUser ? auth.currentUser.getIdToken() : null);

    if (auth) {
      return onAuthStateChanged(auth, async (fb) => {
        if (handlingFlow.current) return;
        if (!fb) {
          apply(null);
          return;
        }
        // Server-side checks must repeat this. The client check is a convenience, not security.
        if (!isCampusEmail(fb.email ?? '') || !fb.emailVerified) {
          await firebaseSignOut(auth!);
          apply(null);
          return;
        }
        apply(toAuthUser(fb));
      });
    }

    if (devMode) {
      try {
        const raw = localStorage.getItem(DEV_KEY);
        if (raw) apply(JSON.parse(raw) as AuthUser);
      } catch {
        /* ignore corrupted dev session */
      }
    }
    setLoading(false);
    return undefined;
  }, [apply]);

  const devSignIn = useCallback(
    (email: string, name?: string) => {
      const clean = email.trim().toLowerCase();
      const next: AuthUser = { uid: `dev-${clean}`, name: name?.trim() || clean.split('@')[0] || 'Member', email: clean };
      try {
        localStorage.setItem(DEV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      apply(next);
    },
    [apply],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error(devMode ? 'Google sign-in needs Firebase. Use the email form in development mode.' : UNAVAILABLE_MESSAGE);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: CAMPUS_EMAIL_DOMAIN, prompt: 'select_account' });
    try {
      const credential = await signInWithPopup(auth, provider);
      if (!isCampusEmail(credential.user.email ?? '')) {
        await firebaseSignOut(auth);
        throw new Error(DOMAIN_MESSAGE);
      }
    } catch (e) {
      throw new Error(messageFor(e));
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!isCampusEmail(email)) throw new Error(DOMAIN_MESSAGE);
      if (!auth) {
        if (!devMode) throw new Error(UNAVAILABLE_MESSAGE);
        devSignIn(email);
        return;
      }
      handlingFlow.current = true;
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!credential.user.emailVerified) {
          await firebaseSignOut(auth);
          throw new Error(UNVERIFIED_MESSAGE);
        }
        apply(toAuthUser(credential.user));
      } catch (e) {
        throw new Error(messageFor(e));
      } finally {
        handlingFlow.current = false;
      }
    },
    [apply, devSignIn],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!isCampusEmail(email)) throw new Error(DOMAIN_MESSAGE);
      if (!auth) {
        if (!devMode) throw new Error(UNAVAILABLE_MESSAGE);
        devSignIn(email, name);
        return;
      }
      handlingFlow.current = true;
      try {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await sendEmailVerification(credential.user);
        await firebaseSignOut(auth);
      } catch (e) {
        throw new Error(messageFor(e));
      } finally {
        handlingFlow.current = false;
        apply(null);
      }
    },
    [apply, devSignIn],
  );

  const resendVerification = useCallback(
    async (email: string, password: string) => {
      if (!isCampusEmail(email)) throw new Error(DOMAIN_MESSAGE);
      if (!auth) throw new Error(UNAVAILABLE_MESSAGE);
      handlingFlow.current = true;
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!credential.user.emailVerified) await sendEmailVerification(credential.user);
        await firebaseSignOut(auth);
      } catch (e) {
        throw new Error(messageFor(e));
      } finally {
        handlingFlow.current = false;
        apply(null);
      }
    },
    [apply],
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!isCampusEmail(email)) throw new Error(DOMAIN_MESSAGE);
    if (!auth) {
      if (devMode) return;
      throw new Error(UNAVAILABLE_MESSAGE);
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
      if (code === 'auth/user-not-found') return; // do not reveal which addresses are registered
      throw new Error(messageFor(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) {
      await firebaseSignOut(auth);
      return;
    }
    try {
      localStorage.removeItem(DEV_KEY);
    } catch {
      /* ignore */
    }
    apply(null);
  }, [apply]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      available: firebaseEnabled || devMode,
      devMode,
      signInWithGoogle,
      signInWithEmail,
      register,
      resendVerification,
      resetPassword,
      signOut,
    }),
    [user, loading, signInWithGoogle, signInWithEmail, register, resendVerification, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

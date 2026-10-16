import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CAMPUS_EMAIL_DOMAIN, isCampusEmail } from '../lib/constants';

type View = 'sign-in' | 'register' | 'reset' | 'verify';

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="label">{children}</label>;
}

export default function SignIn() {
  const { user, loading, available, devMode, signInWithGoogle, signInWithEmail, register, resendVerification, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [view, setView] = useState<View>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!loading && user) return <Navigate to={from} replace />;

  const domainHint = `Must be an @${CAMPUS_EMAIL_DOMAIN} address.`;
  const emailInvalid = email.length > 0 && !isCampusEmail(email);

  async function run(fn: () => Promise<void>, onSuccess?: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      if (onSuccess) {
        setSuccess(onSuccess);
      } else {
        navigate(from, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    await run(() => signInWithGoogle());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (emailInvalid) {
      setError(domainHint);
      return;
    }
    if (view === 'sign-in') {
      await run(() => signInWithEmail(email, password));
    } else if (view === 'register') {
      await run(
        () => register(name, email, password),
        'Account created! Check your inbox for a verification link, then come back and sign in.',
      );
    } else if (view === 'reset') {
      await run(
        () => resetPassword(email),
        'If that email is registered, a reset link has been sent. Check your inbox.',
      );
    } else if (view === 'verify') {
      await run(
        () => resendVerification(email, password),
        'Verification email resent. Check your inbox.',
      );
    }
  }

  const titles: Record<View, string> = {
    'sign-in': 'Sign in to ReturnIt',
    register: 'Create an account',
    reset: 'Reset your password',
    verify: 'Resend verification email',
  };

  const subtitles: Record<View, string> = {
    'sign-in': `Use your @${CAMPUS_EMAIL_DOMAIN} account to access the full campus board.`,
    register: `Open to MNNIT community members with an @${CAMPUS_EMAIL_DOMAIN} address.`,
    reset: 'Enter your campus email and we will send you a reset link.',
    verify: 'Enter your email and password to get a new verification link.',
  };

  function back() {
    setError(null);
    setSuccess(null);
    setView('sign-in');
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <header className="text-center">
        <Link to="/" className="inline-block font-serif text-3xl font-semibold">ReturnIt</Link>
        <h1 className="mt-4 text-2xl font-medium">{titles[view]}</h1>
        <p className="mt-2 text-sm text-muted">{subtitles[view]}</p>
      </header>

      {!available && (
        <div role="alert" className="mt-6 rounded-lg border border-line bg-surface p-4 text-center text-sm text-muted">
          Sign-in is not set up for this environment yet. Add your Firebase credentials to the <code>.env.local</code> file to enable it.
        </div>
      )}

      {available && (
        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
          {view === 'sign-in' && devMode && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <p className="font-medium">Development mode</p>
              <p className="mt-0.5">Firebase is not configured. Type any @mnnit.ac.in address to sign in as a test user.</p>
            </div>
          )}

          {view === 'register' && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <input id="name" type="text" autoComplete="name" maxLength={60} required className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="email">Campus email</Label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              inputMode="email"
              aria-describedby={emailInvalid ? 'email-err' : 'email-hint'}
              aria-invalid={emailInvalid}
              className={`field ${emailInvalid ? 'border-lost focus:border-lost' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${CAMPUS_EMAIL_DOMAIN}`}
            />
            {emailInvalid ? (
              <p id="email-err" role="alert" className="mt-1.5 text-sm text-lost">{domainHint}</p>
            ) : (
              <p id="email-hint" className="mt-1.5 text-xs text-muted">{domainHint}</p>
            )}
          </div>

          {(view === 'sign-in' || view === 'register' || view === 'verify') && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {view === 'sign-in' && (
                  <button type="button" onClick={() => { setError(null); setSuccess(null); setView('reset'); }} className="text-xs font-medium text-accent hover:underline">Forgot password?</button>
                )}
              </div>
              <input
                id="password"
                type="password"
                autoComplete={view === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={view === 'register' ? 10 : 1}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {view === 'register' && <p className="mt-1.5 text-xs text-muted">At least 10 characters.</p>}
            </div>
          )}

          {error && <p id="form-error" role="alert" className="rounded-md border border-lost bg-lost-soft p-3 text-sm text-lost">{error}</p>}
          {success && <p role="status" className="rounded-md border border-accent bg-accent-soft p-3 text-sm text-accent-dark">{success}</p>}

          <button type="submit" disabled={busy} className="btn-primary h-11 w-full">
            {busy ? 'Please wait…' : view === 'sign-in' ? 'Sign in' : view === 'register' ? 'Create account' : view === 'reset' ? 'Send reset link' : 'Resend verification'}
          </button>

          {view === 'sign-in' && !devMode && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-line" aria-hidden />
                <span className="relative mx-auto block w-fit bg-paper px-4 text-xs text-muted">or</span>
              </div>
              <button type="button" disabled={busy} onClick={handleGoogleSignIn} className="btn-secondary h-11 w-full">
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {view === 'sign-in' && (
            <p className="pt-1 text-center text-sm text-muted">
              No account?{' '}
              <button type="button" onClick={() => { setError(null); setSuccess(null); setView('register'); }} className="font-medium text-accent hover:underline">Create one</button>
              {' · '}
              <button type="button" onClick={() => { setError(null); setSuccess(null); setView('verify'); }} className="font-medium text-accent hover:underline">Resend verification</button>
            </p>
          )}

          {view !== 'sign-in' && (
            <p className="pt-1 text-center text-sm">
              <button type="button" onClick={back} className="font-medium text-accent hover:underline">Back to sign in</button>
            </p>
          )}
        </form>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        By signing in you agree that only @{CAMPUS_EMAIL_DOMAIN} accounts may use the platform. Your email is shared only with members you interact with.
      </p>
    </div>
  );
}

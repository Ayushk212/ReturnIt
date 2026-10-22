import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { AlertCircle, ArrowLeft, AtSign, Backpack, CircleCheck, Eye, EyeOff, Headphones, IdCard, Info, KeyRound, LockKeyhole, MailCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { CAMPUS_EMAIL_DOMAIN, isCampusEmail } from '../lib/constants';
import { EASE_OUT } from '../lib/motion';

type View = 'sign-in' | 'register' | 'verify' | 'reset' | 'reset-confirm';

const STICKERS = [
  { Icon: Backpack, className: 'right-[12%] top-[14%] h-24 w-24 rotate-6 bg-cobalt text-white', size: 40 },
  { Icon: KeyRound, className: 'right-[38%] top-[24%] h-16 w-16 -rotate-12 bg-coral text-ink', size: 26 },
  { Icon: IdCard, className: 'right-[6%] top-[38%] h-16 w-20 -rotate-6 bg-paper text-cobalt', size: 28 },
  { Icon: Headphones, className: 'right-[30%] top-[6%] h-14 w-14 rotate-12 bg-lime text-ink', size: 24 },
];

const TITLES: Record<View, string> = {
  'sign-in': 'Sign in to ReturnIt',
  register: 'Create your account',
  verify: 'Verify your email',
  reset: 'Reset your password',
  'reset-confirm': 'Choose a new password',
};

function Field({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export default function SignIn() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [view, setView] = useState<View>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A sign-in that still needs verification (e.g. returning later) lands on the code screen.
  useEffect(() => {
    if (auth.pendingVerification) {
      setEmail(auth.pendingVerification);
      setView('verify');
    }
  }, [auth.pendingVerification]);

  if (!auth.loading && auth.user) return <Navigate to={from} replace />;

  const domainHint = `Use your @${CAMPUS_EMAIL_DOMAIN} address.`;
  const emailInvalid = email.length > 0 && !isCampusEmail(email);

  function go(next: View) {
    setError(null);
    setNotice(null);
    setCode('');
    setView(next);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (view !== 'verify' && view !== 'reset-confirm' && emailInvalid) {
      setError(domainHint);
      return;
    }
    if (view === 'sign-in') {
      await run(async () => {
        if ((await auth.signInWithEmail(email, password)) === 'verify-email') {
          await auth.sendVerificationCode(email);
          setView('verify');
          setNotice(`We sent a 6-digit code to ${email.trim().toLowerCase()}.`);
        }
      });
    } else if (view === 'register') {
      await run(async () => {
        if ((await auth.register(name, email, password)) === 'verify-email') {
          setView('verify');
          setNotice(`Account created. Enter the 6-digit code we sent to ${email.trim().toLowerCase()}.`);
        }
      });
    } else if (view === 'verify') {
      await run(() => auth.verifyEmail(email, code));
    } else if (view === 'reset') {
      await run(async () => {
        await auth.requestPasswordReset(email);
        setView('reset-confirm');
        setNotice('If an account exists for that address, a reset code is on its way.');
      });
    } else {
      await run(async () => {
        await auth.resetPassword(email, code, password);
        setPassword('');
        setCode('');
        setView('sign-in');
        setNotice('Your password has been updated. Sign in with the new password.');
      });
    }
  }

  const submitLabel = {
    'sign-in': 'Sign in',
    register: 'Create account',
    verify: 'Verify email',
    reset: 'Send reset code',
    'reset-confirm': 'Update password',
  }[view];

  const subtitle = {
    'sign-in': `Use your @${CAMPUS_EMAIL_DOMAIN} account to post items, send requests and message other members.`,
    register: `Open to students, faculty and staff with an @${CAMPUS_EMAIL_DOMAIN} address.`,
    verify: `Enter the 6-digit code sent to ${email || 'your campus email'}. Verification confirms that the address belongs to you.`,
    reset: 'Enter your campus email and we will send you a 6-digit reset code.',
    'reset-confirm': `Enter the code sent to ${email} and choose a new password.`,
  }[view];

  const needsPassword = view === 'sign-in' || view === 'register' || view === 'reset-confirm';
  const needsCode = view === 'verify' || view === 'reset-confirm';
  const formError = error ?? auth.authError;

  return (
    <div className="container-page pb-20">
      <div className="grid overflow-hidden rounded-[2rem] border border-line bg-surface shadow-lift lg:min-h-[44rem] lg:grid-cols-2">
        <aside className="on-dark grain relative isolate hidden overflow-hidden bg-night p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div aria-hidden className="absolute -right-32 -top-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-cobalt/40 blur-[110px]" />
          <div aria-hidden className="absolute -bottom-40 -left-20 -z-10 h-[24rem] w-[24rem] rounded-full bg-lime/10 blur-[100px]" />
          {STICKERS.map(({ Icon, className, size }, i) => (
            <span key={i} aria-hidden className={`absolute grid animate-drift place-items-center rounded-[1.4rem] shadow-pop ${className}`} style={{ animationDelay: `${i * -1.7}s` }}>
              <Icon size={size} strokeWidth={1.5} />
            </span>
          ))}
          <Link to="/" className="relative w-fit rounded-full" aria-label="ReturnIt, home">
            <Logo tone="light" />
          </Link>
          <div className="relative mt-auto">
            <h2 className="max-w-md text-display-lg font-bold">
              Your campus, your belongings, <span className="font-serif font-normal italic text-lime">returned</span> safely.
            </h2>
            <ul className="mt-8 space-y-3 text-sm text-white/70">
              <li className="flex gap-3"><AtSign size={18} className="shrink-0 text-lime" aria-hidden /> Access is limited to verified @{CAMPUS_EMAIL_DOMAIN} accounts.</li>
              <li className="flex gap-3"><LockKeyhole size={18} className="shrink-0 text-lime" aria-hidden /> Contact details are shared only after a request is approved.</li>
            </ul>
          </div>
        </aside>

        <div className="flex items-center px-5 py-10 sm:px-12 sm:py-14">
          <div className="mx-auto w-full max-w-sm">
            <header>
              <Link to="/" className="mb-8 inline-block rounded-full lg:hidden" aria-label="ReturnIt, home">
                <Logo />
              </Link>
              <m.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
                {view !== 'sign-in' && (
                  <button type="button" onClick={() => go('sign-in')} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                    <ArrowLeft size={16} aria-hidden /> Back to sign in
                  </button>
                )}
                {view === 'verify' && (
                  <span className="mb-4 grid h-12 w-12 -rotate-6 place-items-center rounded-2xl bg-lime text-ink" aria-hidden>
                    <MailCheck size={22} />
                  </span>
                )}
                <h1 className="text-display-md font-bold">{TITLES[view]}</h1>
                <p className="mt-2 text-sm text-muted">{subtitle}</p>
              </m.div>
            </header>

            {!auth.available ? (
              <div role="alert" className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">
                Sign-in is not configured for this environment. Set <code className="font-mono text-ink">VITE_NEON_AUTH_URL</code> in the frontend environment file.
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
                {auth.demoMode && view === 'sign-in' && (
                  <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Demo mode</p>
                      <p className="mt-0.5">This build uses sample data stored in your browser. Enter any @{CAMPUS_EMAIL_DOMAIN} address and password to continue.</p>
                    </div>
                  </div>
                )}

                {view === 'register' && (
                  <Field id="name" label="Full name">
                    <input id="name" type="text" autoComplete="name" maxLength={60} required className="field" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                )}

                {view !== 'verify' && view !== 'reset-confirm' && (
                  <Field id="email" label="Campus email" hint={domainHint} error={emailInvalid ? domainHint : null}>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      inputMode="email"
                      aria-describedby={emailInvalid ? 'email-err' : 'email-hint'}
                      aria-invalid={emailInvalid}
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={`you@${CAMPUS_EMAIL_DOMAIN}`}
                    />
                  </Field>
                )}

                {needsCode && (
                  <Field id="code" label="Verification code" hint="The code expires after a few minutes.">
                    <input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      className="field text-center font-mono text-lg tracking-[0.5em]"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                    />
                  </Field>
                )}

                {needsPassword && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="label">{view === 'reset-confirm' ? 'New password' : 'Password'}</label>
                      {view === 'sign-in' && !auth.demoMode && (
                        <button type="button" onClick={() => go('reset')} className="mb-2 text-xs font-semibold text-cobalt hover:underline">Forgot password?</button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={view === 'sign-in' ? 'current-password' : 'new-password'}
                        required
                        minLength={view === 'sign-in' ? 1 : 10}
                        className="field pr-12"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
                      >
                        {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                      </button>
                    </div>
                    {view !== 'sign-in' && <p className="hint">At least 10 characters.</p>}
                  </div>
                )}

                {formError && (
                  <p role="alert" className="flex gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">
                    <AlertCircle size={17} aria-hidden className="mt-px shrink-0" /> {formError}
                  </p>
                )}
                {notice && (
                  <p role="status" className="flex gap-2 rounded-xl border border-lime-ink/20 bg-lime-soft p-3 text-sm font-medium text-lime-ink">
                    <CircleCheck size={17} aria-hidden className="mt-px shrink-0" /> {notice}
                  </p>
                )}

                <button type="submit" disabled={busy || (needsCode && code.length !== 6)} className="btn-ink btn-lg w-full">
                  {busy ? 'Please wait…' : submitLabel}
                </button>

                {view === 'verify' && (
                  <p className="text-center text-sm text-muted">
                    Did not receive it?{' '}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(async () => { await auth.sendVerificationCode(email); setNotice('A new code has been sent.'); })}
                      className="font-semibold text-cobalt hover:underline"
                    >
                      Send a new code
                    </button>
                  </p>
                )}

                {view === 'sign-in' && !auth.demoMode && (
                  <>
                    <div className="relative my-1">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-line" aria-hidden />
                      <span className="eyebrow relative mx-auto block w-fit bg-surface px-4 text-muted">or</span>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { auth.clearAuthError(); void run(() => auth.signInWithGoogle(from)); }}
                      className="btn-secondary btn-lg w-full"
                    >
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
                    New to ReturnIt?{' '}
                    <button type="button" onClick={() => go('register')} className="font-semibold text-cobalt hover:underline">Create an account</button>
                  </p>
                )}
              </form>
            )}

            <p className="mt-10 text-xs leading-relaxed text-muted">
              ReturnIt is available only to @{CAMPUS_EMAIL_DOMAIN} accounts. Your email address is shared only with members whose requests you approve, or who approve yours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

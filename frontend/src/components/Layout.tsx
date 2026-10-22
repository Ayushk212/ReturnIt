import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'motion/react';
import {
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  Inbox,
  LayoutList,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { EASE_OUT, spring } from '../lib/motion';
import Avatar from './Avatar';
import Logo from './Logo';
import { PageLoader } from './States';

function useScrolled(threshold = 16) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);
  return scrolled;
}

/** Closes a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** Pages with a dark, full-bleed header sit under a dark navigation bar. */
const IMMERSIVE = [/^\/$/, /^\/recent$/, /^\/profile$/, /^\/u\/[^/]+$/, /^\/messages(\/[^/]+)?$/];
/** Pages a signed-in member can use before completing onboarding. */
const ONBOARDING_EXEMPT = ['/welcome', '/signin', '/safety'];

function Badge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 font-mono text-[10px] font-semibold leading-none text-ink ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const { summary } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const dark = IMMERSIVE.some((r) => r.test(pathname));
  const accountRef = useDismiss(accountOpen, () => setAccountOpen(false));
  const searchRef = useDismiss(searchOpen, () => setSearchOpen(false));

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/dashboard?${new URLSearchParams({ q }).toString()}` : '/dashboard');
    setQuery('');
  }

  // First-time members complete their profile before using the app.
  if (user && profile && !profile.onboarded && !ONBOARDING_EXEMPT.includes(pathname)) {
    return <Navigate to={`/welcome?next=${encodeURIComponent(pathname + search)}`} replace />;
  }

  const links = [
    { to: '/dashboard', label: 'Browse' },
    { to: '/recent', label: 'Recent' },
    { to: '/safety', label: 'How it works' },
  ];

  const accountLinks: { to: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { to: '/profile', label: 'My profile', icon: UserRound },
    { to: '/profile?tab=reports', label: 'My reports', icon: LayoutList },
    { to: '/profile?tab=saved', label: 'Saved items', icon: Bookmark },
    { to: '/profile?tab=requests', label: 'Requests', icon: Inbox, badge: summary.pendingRequests },
    { to: '/messages', label: 'Messages', icon: MessageCircle, badge: summary.unreadMessages },
    { to: '/profile?tab=settings', label: 'Edit profile', icon: Settings },
  ];

  const pill = dark
    ? `on-dark border-white/10 text-white ${scrolled || menuOpen ? 'bg-night/85 shadow-pop' : 'bg-night/40'}`
    : `border-line text-ink ${scrolled || menuOpen ? 'bg-surface/90 shadow-lift' : 'bg-paper/70'}`;
  const iconButton = `relative grid h-10 w-10 place-items-center rounded-full transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-ink/[0.06]'}`;
  const popover = 'absolute right-0 top-[calc(100%+0.6rem)] z-50 origin-top-right rounded-2xl border border-line bg-surface p-2 text-ink shadow-pop';
  const displayName = profile?.name ?? user?.name ?? '';

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto max-w-page">
          <div className={`flex h-14 items-center justify-between gap-2 rounded-full border pl-3 pr-2 backdrop-blur-xl transition-[background-color,box-shadow] duration-300 sm:pl-4 ${pill}`}>
            <Link to="/" aria-label="ReturnIt, home" className="rounded-full">
              <Logo tone={dark ? 'light' : 'dark'} />
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive ? '' : dark ? 'text-white/70 hover:text-white' : 'text-muted hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <m.span layoutId="nav-active" transition={spring} className={`absolute inset-0 rounded-full ${dark ? 'bg-white/10' : 'bg-ink/[0.07]'}`} aria-hidden />
                      )}
                      <span className="relative">{l.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <div ref={searchRef} className="relative hidden sm:block">
                <button type="button" className={iconButton} aria-label="Search listings" aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
                  <Search size={18} aria-hidden />
                </button>
                <AnimatePresence>
                  {searchOpen && (
                    <m.form
                      role="search"
                      onSubmit={submitSearch}
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      className={`${popover} flex w-[min(24rem,calc(100vw-2rem))] items-center gap-2 p-2 pl-4`}
                    >
                      <Search size={16} aria-hidden className="shrink-0 text-muted" />
                      <label htmlFor="nav-search" className="sr-only">Search the board</label>
                      <input
                        id="nav-search"
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search items, places or descriptions"
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                      />
                      <button type="submit" className="btn-ink btn-sm">Search</button>
                    </m.form>
                  )}
                </AnimatePresence>
              </div>

              {user && (
                <Link to="/messages" className={iconButton} aria-label={`Messages${summary.unreadMessages ? `, ${summary.unreadMessages} unread` : ''}`}>
                  <MessageCircle size={19} aria-hidden />
                  <Badge count={summary.unreadMessages} className="absolute -right-0.5 -top-0.5" />
                </Link>
              )}

              {user ? (
                <div ref={accountRef} className="relative hidden lg:block">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((o) => !o)}
                    className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-ink/[0.06]'}`}
                  >
                    <span className="relative">
                      <Avatar name={displayName} src={profile?.avatarUrl} size="sm" />
                      <Badge count={summary.pendingRequests} className="absolute -right-1 -top-1" />
                    </span>
                    <ChevronDown size={15} aria-hidden className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                    <span className="sr-only">Account menu</span>
                  </button>
                  <AnimatePresence>
                    {accountOpen && (
                      <m.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                        className={`${popover} w-64`}
                      >
                        <div className="flex items-center gap-3 px-3 pb-3 pt-2">
                          <Avatar name={displayName} src={profile?.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{displayName}</p>
                            <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
                          </div>
                        </div>
                        <div className="border-t border-line pt-1.5">
                          {accountLinks.map((l) => (
                            <Link key={l.to} role="menuitem" to={l.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-paper">
                              <l.icon size={16} aria-hidden className="text-muted" />
                              <span className="flex-1">{l.label}</span>
                              <Badge count={l.badge ?? 0} />
                            </Link>
                          ))}
                        </div>
                        <div className="mt-1.5 border-t border-line pt-1.5">
                          <button type="button" role="menuitem" onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft">
                            <LogOut size={16} aria-hidden /> Sign out
                          </button>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/signin" className={`btn-sm hidden lg:inline-flex ${dark ? 'btn text-white/80 hover:bg-white/10 hover:text-white' : 'btn-ghost'}`}>
                  Sign in
                </Link>
              )}

              <Link to="/post" className="btn-lime btn-sm hidden sm:inline-flex">
                <Plus size={15} strokeWidth={2.5} aria-hidden /> Post an item
              </Link>

              <button
                type="button"
                className={`${iconButton} lg:hidden`}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
                {!menuOpen && <Badge count={summary.pendingRequests} className="absolute -right-0.5 -top-0.5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <m.nav
                id="mobile-nav"
                aria-label="Mobile"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className="on-dark mt-2 max-h-[calc(100svh-6rem)] origin-top overflow-y-auto rounded-panel border border-white/10 bg-night p-3 text-white shadow-pop lg:hidden"
              >
                <form role="search" onSubmit={submitSearch} className="mb-2 flex items-center gap-2 rounded-2xl bg-white/[0.06] p-1.5 pl-4 sm:hidden">
                  <Search size={16} aria-hidden className="shrink-0 text-white/50" />
                  <label htmlFor="mobile-search" className="sr-only">Search the board</label>
                  <input
                    id="mobile-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search the board"
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                  />
                  <button type="submit" className="btn-lime btn-sm">Go</button>
                </form>
                <ul>
                  {links.map((l) => (
                    <MobileLink key={l.to} to={l.to}>{l.label}</MobileLink>
                  ))}
                </ul>
                {user && (
                  <>
                    <p className="eyebrow mt-3 px-4 text-white/40">Your account</p>
                    <ul className="mt-1">
                      {accountLinks.map((l) => (
                        <li key={l.to}>
                          <Link to={l.to} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-white/80 hover:bg-white/10 hover:text-white">
                            <l.icon size={18} aria-hidden className="text-white/50" />
                            <span className="flex-1">{l.label}</span>
                            <Badge count={l.badge ?? 0} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                  <Link to="/post" className="btn-lime">
                    <Plus size={16} strokeWidth={2.5} aria-hidden /> Post an item
                  </Link>
                  {user ? (
                    <button type="button" onClick={handleSignOut} className="btn-glass">Sign out</button>
                  ) : (
                    <Link to="/signin" className="btn-glass">Sign in</Link>
                  )}
                </div>
              </m.nav>
            )}
          </AnimatePresence>
        </div>
      </header>

      <m.main
        // Switching conversations keeps the Messages page mounted; other routes fade in fresh.
        key={pathname.startsWith('/messages') ? '/messages' : pathname}
        id="main"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className={`flex-1 ${dark ? '' : 'pt-24 sm:pt-28'}`}
      >
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </m.main>

      {pathname !== '/messages' && !pathname.startsWith('/messages/') && <SiteFooter signedIn={Boolean(user)} />}
    </div>
  );
}

function MobileLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `flex items-center justify-between rounded-2xl px-4 py-3 font-display text-xl font-semibold tracking-tight ${
            isActive ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white'
          }`
        }
      >
        {children}
        <ArrowUpRight size={18} aria-hidden className="text-white/40" />
      </NavLink>
    </li>
  );
}

function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const linkClass = 'text-white/75 transition-colors hover:text-lime';
  return (
    <footer className="on-dark grain relative isolate overflow-hidden bg-night text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-cobalt/20 blur-3xl" />
      <div className="container-page grid gap-12 pb-10 pt-16 sm:pt-20 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo tone="light" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            The lost and found platform for the MNNIT Allahabad community. Access is limited to verified @mnnit.ac.in accounts.
          </p>
        </div>
        <nav aria-label="Explore" className="lg:col-span-2">
          <p className="eyebrow text-white/40">Explore</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link to="/dashboard" className={linkClass}>Browse listings</Link></li>
            <li><Link to="/recent" className={linkClass}>Recently reported</Link></li>
            <li><Link to="/post" className={linkClass}>Post an item</Link></li>
            <li><Link to="/safety" className={linkClass}>How it works</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account" className="lg:col-span-2">
          <p className="eyebrow text-white/40">Account</p>
          <ul className="mt-4 space-y-3 text-sm">
            {signedIn ? (
              <>
                <li><Link to="/profile" className={linkClass}>My profile</Link></li>
                <li><Link to="/messages" className={linkClass}>Messages</Link></li>
                <li><Link to="/profile?tab=saved" className={linkClass}>Saved items</Link></li>
              </>
            ) : (
              <li><Link to="/signin" className={linkClass}>Sign in</Link></li>
            )}
          </ul>
        </nav>
        <div className="lg:col-span-4">
          <p className="eyebrow text-white/40">Privacy</p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Email addresses and phone numbers are never shown publicly. Conversations happen in ReturnIt Messages, and contact details are shared only between two members after a request is approved.
          </p>
        </div>
      </div>

      <p aria-hidden className="pointer-events-none select-none text-center font-display text-[23vw] font-extrabold leading-[0.78] tracking-[-0.035em] text-[#121828]">
        ReturnIt
      </p>

      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-white/45">© {new Date().getFullYear()} ReturnIt. Built for the MNNIT Allahabad community.</p>
      </div>
    </footer>
  );
}

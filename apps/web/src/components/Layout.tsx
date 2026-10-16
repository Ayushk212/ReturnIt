import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 py-5 text-sm font-medium ${isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-black/5 text-ink' : 'text-muted hover:text-ink'}`;

export default function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2" aria-label="ReturnIt, home">
            <span className="font-serif text-2xl font-semibold tracking-tight">ReturnIt</span>
            <span className="hidden text-xs text-muted sm:inline">MNNIT Allahabad</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            <NavLink to="/dashboard" className={desktopLink}>Browse</NavLink>
            <NavLink to="/safety" className={desktopLink}>How it works</NavLink>
            {user && <NavLink to="/profile" className={desktopLink}>My account</NavLink>}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to="/post" className="btn-primary">Post an item</Link>
                <button type="button" onClick={handleSignOut} className="btn-ghost">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="btn-ghost">Sign in</Link>
                <Link to="/post" className="btn-primary">Post an item</Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn-ghost px-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper px-4 pb-4 pt-2 md:hidden">
            <NavLink to="/dashboard" className={mobileLink}>Browse</NavLink>
            <NavLink to="/safety" className={mobileLink}>How it works</NavLink>
            {user && <NavLink to="/profile" className={mobileLink}>My account</NavLink>}
            <div className="mt-3 flex gap-2">
              <Link to="/post" className="btn-primary flex-1">Post an item</Link>
              {user ? (
                <button type="button" onClick={handleSignOut} className="btn-secondary">Sign out</button>
              ) : (
                <Link to="/signin" className="btn-secondary">Sign in</Link>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
          <div>
            <p className="font-serif text-xl font-semibold">ReturnIt</p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              A lost and found board for the MNNIT Allahabad community. Access to listings is limited to @mnnit.ac.in accounts.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-sm font-medium">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link to="/dashboard" className="hover:text-ink">Browse listings</Link></li>
              <li><Link to="/post" className="hover:text-ink">Post an item</Link></li>
              <li><Link to="/safety" className="hover:text-ink">How it works and safety</Link></li>
            </ul>
          </nav>
          <div>
            <p className="text-sm font-medium">Your privacy</p>
            <p className="mt-3 text-sm text-muted">
              Your email and phone number are never shown publicly. They are shared only with the other person after an owner approves a request.
            </p>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="container-page py-4 text-xs text-muted">© {new Date().getFullYear()} ReturnIt. Made for the MNNIT community.</p>
        </div>
      </footer>
    </div>
  );
}

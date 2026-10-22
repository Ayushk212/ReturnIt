import { Link } from 'react-router-dom';
import { m } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-page grid grid-cols-1 items-center gap-12 overflow-x-clip pb-24 pt-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="eyebrow text-muted">Error 404</p>
        <h1 className="mt-3 text-display-xl font-bold">This page could not be found.</h1>
        <p className="mt-4 max-w-md text-muted">The link may be out of date, or the listing may have been removed.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary btn-lg">Go to the homepage</Link>
          <Link to="/dashboard" className="btn-secondary btn-lg">
            Browse listings <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </div>

      {/* A lost-property tag for the missing page itself. */}
      <m.div
        aria-hidden
        initial={{ opacity: 0, rotate: -14, y: -30 }}
        animate={{ opacity: 1, rotate: -6, y: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 11, delay: 0.15 }}
        className="relative mx-auto mt-10 w-full max-w-[15rem] origin-top sm:max-w-xs lg:col-span-5 lg:mt-0"
      >
        <span className="absolute -top-16 left-1/2 h-16 w-px bg-gradient-to-b from-transparent to-ink/40" />
        <div className="relative rounded-[1.75rem] bg-coral p-7 text-ink shadow-pop" style={{ clipPath: 'polygon(22% 0, 78% 0, 100% 14%, 100% 100%, 0 100%, 0 14%)' }}>
          <span className="mx-auto mb-6 block h-5 w-5 rounded-full bg-paper ring-4 ring-ink/10" />
          <p className="eyebrow text-ink/60">Lost property</p>
          <p className="mt-3 font-display text-[5.5rem] font-extrabold leading-none tracking-tighter">404</p>
          <div className="perforation mt-5 opacity-60" />
          <dl className="mt-4 space-y-2 font-mono text-xs">
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Item</dt><dd>One web page</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Last seen</dt><dd>The link you followed</dd></div>
          </dl>
        </div>
      </m.div>
    </div>
  );
}

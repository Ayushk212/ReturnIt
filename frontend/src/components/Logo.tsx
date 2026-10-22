interface Props {
  tone?: 'light' | 'dark';
  showCampus?: boolean;
  className?: string;
}

/** Tag mark: the paper tag tied to every item handed in at a lost & found desk. */
export function TagMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <g transform="rotate(-8 16 16)">
        <path d="M11 5h10l4.5 4.8V25a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2V9.8L11 5Z" fill="#C8F04A" />
        <circle cx="16" cy="10.5" r="2.3" fill="#070B18" />
        <path d="M11.5 18.5h9M11.5 22h6" stroke="#070B18" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function Logo({ tone = 'dark', showCampus = true, className = '' }: Props) {
  const light = tone === 'light';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`grid h-8 w-8 place-items-center rounded-[10px] ${light ? 'bg-white/[0.08]' : 'bg-night'}`}>
        <TagMark className="h-6 w-6" />
      </span>
      <span className="font-display text-[1.3rem] font-bold leading-none tracking-[-0.04em]">ReturnIt</span>
      {showCampus && (
        <span
          className={`hidden rounded-md px-1.5 py-1 font-mono text-[10px] font-medium uppercase leading-none tracking-wider sm:inline md:hidden lg:inline ${
            light ? 'bg-white/10 text-white/70' : 'bg-ink/[0.06] text-muted'
          }`}
        >
          MNNIT
        </span>
      )}
    </span>
  );
}

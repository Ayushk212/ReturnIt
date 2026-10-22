import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck } from 'lucide-react';
import { TagMark } from '../Logo';
import { Magnetic, Reveal } from '../Motion';

export default function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="on-dark relative isolate mx-auto max-w-[96rem] overflow-hidden rounded-[2rem] bg-cobalt text-white sm:rounded-[2.5rem]">
        <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-lime/30 blur-[100px]" />
        <TagMark className="pointer-events-none absolute -bottom-24 -right-10 -z-10 h-[26rem] w-[26rem] rotate-12 opacity-[0.16] sm:h-[34rem] sm:w-[34rem]" />
        <Reveal className="container-page py-20 sm:py-28">
          <p className="eyebrow text-white/60">Found an item on campus?</p>
          <h2 id="cta-heading" className="mt-5 max-w-4xl text-display-xl font-bold">
            Report a found item in <span className="font-serif font-normal italic text-lime">under a minute.</span>
          </h2>
          <p className="mt-5 max-w-lg text-lg text-white/75">The owner may already be searching for it. A short report helps them find it quickly.</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link to="/post?type=found" className="btn-lime btn-lg">
                <PackageCheck size={18} aria-hidden /> Post a found item
              </Link>
            </Magnetic>
            <Link to="/dashboard" className="btn-glass btn-lg">
              Browse the board <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

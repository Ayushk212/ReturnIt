import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '../../lib/constants';
import { TONE_CLASSES, categoryMeta } from '../../lib/categoryMeta';
import type { Item } from '../../lib/types';
import { Reveal, RevealGroup, RevealItem } from '../Motion';

export default function Categories({ items, loading }: { items: Item[]; loading: boolean }) {
  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section aria-labelledby="categories-heading" className="container-page py-20 sm:py-28">
      <Reveal className="grid items-end gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="eyebrow text-muted">Browse by category</p>
          <h2 id="categories-heading" className="mt-3 text-display-lg font-bold">What are you looking for?</h2>
        </div>
        <p className="max-w-md text-muted lg:col-span-5 lg:justify-self-end">
          Go directly to the category you need. Counts show listings that are currently open.
        </p>
      </Reveal>

      <RevealGroup gap={0.05} className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const { icon: Icon, tone } = categoryMeta(c.value);
          const t = TONE_CLASSES[tone];
          const n = counts[c.value] ?? 0;
          return (
            <RevealItem key={c.value}>
              <Link
                to={`/dashboard?category=${c.value}`}
                className="group relative flex h-full min-h-[10.5rem] flex-col justify-between overflow-hidden rounded-card border border-line bg-surface p-4 transition duration-300 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-lift sm:min-h-[12rem] sm:p-5"
              >
                <span className="flex items-start justify-between">
                  <span className={`grid h-12 w-12 -rotate-6 place-items-center rounded-2xl transition-transform duration-500 ease-out group-hover:rotate-3 group-hover:scale-110 ${t.surface} ${t.ink}`}>
                    <Icon size={22} strokeWidth={1.7} aria-hidden />
                  </span>
                  <ArrowUpRight size={18} aria-hidden className="text-muted transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold leading-tight tracking-tight sm:text-xl">{c.label}</span>
                  <span className="eyebrow mt-1.5 block text-muted">
                    {loading ? 'Counting…' : n === 0 ? 'None open' : `${n} open`}
                  </span>
                </span>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}

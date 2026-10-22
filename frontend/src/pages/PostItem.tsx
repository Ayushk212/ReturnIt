import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, m } from 'motion/react';
import { AlertCircle, Camera, Check, ImagePlus, LockKeyhole, MapPin, PackageCheck, Search, Sparkles, X } from 'lucide-react';
import { CategoryArt } from '../components/ItemImage';
import TypeLabel from '../components/TypeLabel';
import { api } from '../lib/api';
import { categoryLabel } from '../lib/categoryMeta';
import { CATEGORIES, LOCATIONS } from '../lib/constants';
import { compressImage, formatBytes } from '../lib/imageCompression';
import { EASE_OUT } from '../lib/motion';
import type { ItemType } from '../lib/types';

const MAX_FILES = 5;
// Originals up to 20 MB are accepted; they are compressed in the browser before upload.
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

interface FormState {
  type: ItemType | '';
  title: string;
  category: string;
  place: string;
  placeDetail: string;
  date: string;
  description: string;
  question: string;
  answer: string;
}

const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger">
      <AlertCircle size={14} aria-hidden className="shrink-0" /> {message}
    </p>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span aria-hidden className={`font-mono text-[11px] ${value.length >= max ? 'text-danger' : 'text-muted'}`}>
      {value.length}/{max}
    </span>
  );
}

function Section({ n, title, description, children }: { n: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`section-${n}`} className="card p-5 sm:p-8">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-muted">{n}</span>
        <h2 id={`section-${n}`} className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {description && <p className="mt-1.5 pl-8 text-sm text-muted">{description}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

const TYPE_OPTIONS = [
  { value: 'lost' as const, icon: Search, title: 'I lost something', body: 'Describe it so finders can recognise it.', on: 'bg-coral' },
  { value: 'found' as const, icon: PackageCheck, title: 'I found something', body: 'Add a private question so only the owner can claim it.', on: 'bg-lime' },
];

export default function PostItem() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = params.get('type');
  const [form, setForm] = useState<FormState>({
    type: initialType === 'lost' || initialType === 'found' ? initialType : '',
    title: '',
    category: '',
    place: '',
    placeDetail: '',
    date: '',
    description: '',
    question: '',
    answer: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [savings, setSavings] = useState({ before: 0, after: 0 });
  const idempotencyKey = useRef(crypto.randomUUID());
  const submitted = useRef(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const dirty = Boolean(form.title || form.description || form.question || files.length);
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      if (submitted.current) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function addFiles(picked: File[]) {
    let problem: string | null = null;
    const room = MAX_FILES - files.length;
    if (picked.length > room) problem = `You can add up to ${MAX_FILES} photos.`;
    const candidates: File[] = [];
    for (const file of picked.slice(0, Math.max(room, 0))) {
      if (!ALLOWED.includes(file.type)) problem = 'Only JPG, PNG or WebP images are allowed.';
      else if (file.size > MAX_BYTES) problem = 'Each photo must be smaller than 20 MB.';
      else candidates.push(file);
    }
    setFileError(problem);
    if (candidates.length === 0) return;

    // Compress in the browser so large phone photos upload quickly.
    setCompressing(true);
    const results: File[] = [];
    let before = 0;
    let after = 0;
    for (const file of candidates) {
      try {
        const out = await compressImage(file);
        results.push(out.file);
        before += out.originalBytes;
        after += out.bytes;
      } catch {
        problem = 'One photo could not be processed. Try a different image.';
      }
    }
    setCompressing(false);
    setFiles((current) => [...current, ...results].slice(0, MAX_FILES));
    setFileError(problem);
    if (after < before) setSavings((s) => ({ before: s.before + before, after: s.after + after }));
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    void addFiles(picked);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.type) e.type = 'Choose whether you lost or found something.';
    if (form.title.trim().length < 3) e.title = 'Enter a short title (at least 3 characters).';
    if (!form.category) e.category = 'Choose a category.';
    if (!form.place) e.place = 'Choose where it happened.';
    if (!form.date) e.date = 'Choose the date.';
    else if (form.date > localToday()) e.date = 'The date cannot be in the future.';
    if (form.description.trim().length < 10) e.description = 'Add a few details (at least 10 characters).';
    if (form.type === 'found') {
      if (form.question.trim().length < 5) e.question = 'Write a question only the real owner could answer.';
      if (form.answer.trim().length < 1) e.answer = 'Enter the answer so you can check claims.';
    }
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !form.type) {
      document.getElementById('form-summary')?.focus();
      return;
    }
    setBusy(true);
    setSubmitError(null);
    const date = form.date === localToday() ? new Date().toISOString() : new Date(`${form.date}T12:00:00`).toISOString();
    try {
      const item = await api.createItem({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        locationLabel: form.placeDetail.trim() ? `${form.place}, ${form.placeDetail.trim()}` : form.place,
        dateOccurred: date,
        verificationQuestion: form.type === 'found' ? form.question.trim() : undefined,
        verificationAnswer: form.type === 'found' ? form.answer.trim() : undefined,
        images: files,
        idempotencyKey: idempotencyKey.current,
      });
      submitted.current = true;
      navigate(`/items/${item.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not post your listing. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const errorList = Object.values(errors);
  const isFound = form.type === 'found';
  const previewLocation = form.place ? (form.placeDetail.trim() ? `${form.place}, ${form.placeDetail.trim()}` : form.place) : 'Where on campus';

  return (
    <div className="container-page pb-24">
      <header className="max-w-3xl">
        <p className="eyebrow text-muted">New listing</p>
        <h1 className="mt-3 text-display-xl font-bold">Post an item</h1>
        <p className="mt-4 max-w-xl text-muted">Clear details and a photo make it much more likely the item finds its way back.</p>
      </header>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
        <form onSubmit={onSubmit} noValidate className="space-y-5 lg:col-span-7">
          <div id="form-summary" tabIndex={-1} aria-live="polite" className="outline-none">
            {errorList.length > 0 && (
              <div role="alert" className="flex gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
                <AlertCircle size={18} aria-hidden className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Please fix {errorList.length === 1 ? 'this' : 'these'} before posting:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {errorList.map((msg) => <li key={msg}>{msg}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <section aria-label="Listing type" className="card p-5 sm:p-8">
            <fieldset>
              <legend className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-muted">01</span>
                <span className="font-display text-xl font-semibold tracking-tight">What are you reporting?</span>
              </legend>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {TYPE_OPTIONS.map((t) => {
                  const selected = form.type === t.value;
                  return (
                    <label
                      key={t.value}
                      className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 transition duration-200 focus-within:ring-4 focus-within:ring-cobalt/25 ${
                        selected ? `border-ink ${t.on}` : 'border-line bg-surface hover:border-line-strong hover:bg-paper/60'
                      }`}
                    >
                      <input type="radio" name="type" value={t.value} checked={selected} onChange={() => set('type', t.value)} className="sr-only" />
                      <span className="flex items-center justify-between">
                        <span className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${selected ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
                          <t.icon size={20} aria-hidden />
                        </span>
                        <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full border-2 transition ${selected ? 'border-ink bg-ink text-white' : 'border-line-strong'}`}>
                          {selected && <Check size={14} strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="font-display text-xl font-semibold tracking-tight">{t.title}</span>
                      <span className={`text-sm ${selected ? 'text-ink/75' : 'text-muted'}`}>{t.body}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError id="type-err" message={errors.type} />
            </fieldset>
          </section>

          <Section n="02" title="Describe the item" description="All fields are required unless marked optional.">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="title" className="label">Title</label>
                <Counter value={form.title} max={80} />
              </div>
              <input id="title" className="field" maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-err' : undefined} placeholder="e.g. Black leather wallet" />
              <FieldError id="title-err" message={errors.title} />
            </div>

            <div>
              <label htmlFor="category" className="label">Category</label>
              <select id="category" className="field" value={form.category} onChange={(e) => set('category', e.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'category-err' : undefined}>
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <FieldError id="category-err" message={errors.category} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="description" className="label">Description</label>
                <Counter value={form.description} max={1000} />
              </div>
              <textarea id="description" rows={5} maxLength={1000} className="field" value={form.description} onChange={(e) => set('description', e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-err' : 'description-hint'} />
              <p id="description-hint" className="hint">Colour, brand, size and any marks help. {isFound && 'Leave out details only the owner would know.'}</p>
              <FieldError id="description-err" message={errors.description} />
            </div>
          </Section>

          <Section n="03" title="Where and when">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="place" className="label">Where on campus</label>
                <select id="place" className="field" value={form.place} onChange={(e) => set('place', e.target.value)} aria-invalid={Boolean(errors.place)} aria-describedby={errors.place ? 'place-err' : undefined}>
                  <option value="">Select a location</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <FieldError id="place-err" message={errors.place} />
              </div>
              <div>
                <label htmlFor="placeDetail" className="label">More detail <span className="optional">Optional</span></label>
                <input id="placeDetail" className="field" maxLength={80} value={form.placeDetail} onChange={(e) => set('placeDetail', e.target.value)} placeholder="e.g. second floor reading room" />
              </div>
            </div>
            <div className="sm:max-w-[calc(50%-0.75rem)]">
              <label htmlFor="date" className="label">{isFound ? 'Date found' : 'Date lost'}</label>
              <input id="date" type="date" className="field" max={localToday()} value={form.date} onChange={(e) => set('date', e.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-err' : undefined} />
              <FieldError id="date-err" message={errors.date} />
            </div>
          </Section>

          <Section n="04" title="Photos" description={`Optional, up to ${MAX_FILES}. A photo is the fastest way for someone to recognise an item.`}>
            <div>
              <label
                htmlFor="photos"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center text-sm transition focus-within:ring-4 focus-within:ring-cobalt/25 ${
                  dragging ? 'border-cobalt bg-cobalt-soft text-cobalt-ink' : 'border-line-strong bg-paper/60 text-muted hover:border-ink hover:text-ink'
                }`}
              >
                <span className="grid h-12 w-12 -rotate-6 place-items-center rounded-2xl bg-surface text-ink shadow-lift ring-1 ring-ink/5" aria-hidden>
                  <ImagePlus size={22} />
                </span>
                <span>
                  <span className="font-semibold text-ink">Add photos</span> or drop them here
                  <span className="mt-1 block text-xs">JPG, PNG or WebP, up to 20 MB each. Photos are compressed automatically. {files.length}/{MAX_FILES} added</span>
                </span>
                <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} disabled={compressing} className="sr-only" />
              </label>
              <p className="mt-2 text-xs text-muted" aria-live="polite">
                {compressing
                  ? 'Optimising photos…'
                  : savings.after > 0
                    ? `Photos optimised from ${formatBytes(savings.before)} to ${formatBytes(savings.after)}. Location data is removed when they are stored.`
                    : ''}
              </p>
              {fileError && <FieldError id="photos-err" message={fileError} />}
              {previews.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  <AnimatePresence initial={false}>
                    {previews.map((url, i) => (
                      <m.li
                        key={url}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        className="relative aspect-square"
                      >
                        <img src={url} alt={`Selected photo ${i + 1}`} className="h-full w-full rounded-xl border border-line object-cover" />
                        {i === 0 && <span className="chip absolute bottom-1.5 left-1.5 bg-night/75 py-0.5 text-[9px] text-white">Cover</span>}
                        <button
                          type="button"
                          onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))}
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-line bg-surface shadow-lift transition hover:scale-110 hover:bg-paper"
                        >
                          <X size={13} aria-hidden />
                        </button>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </Section>

          <AnimatePresence initial={false}>
            {isFound && (
              <m.div
                key="verification"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <fieldset className="on-dark rounded-card bg-night p-5 text-white sm:p-8">
                  <legend className="sr-only">Private verification</legend>
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime text-ink" aria-hidden>
                      <LockKeyhole size={20} />
                    </span>
                    <div>
                      <p className="flex items-baseline gap-3">
                        <span className="font-mono text-xs text-white/45">05</span>
                        <span className="font-display text-xl font-semibold tracking-tight" aria-hidden>Private verification</span>
                      </p>
                      <p className="mt-1.5 text-sm text-white/60">Claimants will see only your question. The answer is never shown to anyone else.</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="question" className="label text-white">Question for the owner</label>
                        <span className="font-mono text-[11px] text-white/45" aria-hidden>{form.question.length}/140</span>
                      </div>
                      <input id="question" className="field border-white/15 bg-white/[0.06] text-white placeholder:text-white/35 hover:border-white/25 focus:border-lime focus:ring-lime/20" maxLength={140} value={form.question} onChange={(e) => set('question', e.target.value)} aria-invalid={Boolean(errors.question)} aria-describedby={errors.question ? 'question-err' : undefined} placeholder="e.g. What is the wallpaper on the lock screen?" />
                      {errors.question && <p id="question-err" role="alert" className="mt-1.5 text-sm font-medium text-coral">{errors.question}</p>}
                    </div>
                    <div>
                      <label htmlFor="answer" className="label text-white">Correct answer</label>
                      <input id="answer" className="field border-white/15 bg-white/[0.06] text-white placeholder:text-white/35 hover:border-white/25 focus:border-lime focus:ring-lime/20" maxLength={140} value={form.answer} onChange={(e) => set('answer', e.target.value)} aria-invalid={Boolean(errors.answer)} aria-describedby={errors.answer ? 'answer-err' : undefined} autoComplete="off" />
                      {errors.answer && <p id="answer-err" role="alert" className="mt-1.5 text-sm font-medium text-coral">{errors.answer}</p>}
                    </div>
                  </div>
                </fieldset>
              </m.div>
            )}
          </AnimatePresence>

          {submitError && (
            <p role="alert" className="flex gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">
              <AlertCircle size={18} aria-hidden className="shrink-0" /> {submitError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary btn-lg">Cancel</button>
            <button type="submit" disabled={busy || compressing} className="btn-primary btn-lg sm:min-w-[12rem]">
              {busy ? 'Posting…' : 'Post listing'}
            </button>
          </div>
        </form>

        {/* self-stretch gives the sticky preview the full form height to travel within. */}
        <aside className="hidden self-stretch lg:col-span-5 lg:block" aria-label="Listing preview">
          <div className="sticky top-28 space-y-4">
            <p className="eyebrow flex items-center gap-2 text-muted">
              <Sparkles size={13} aria-hidden /> Preview on the board
            </p>
            <div aria-hidden className="rounded-card border border-line bg-surface p-2 shadow-lift">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[0.9rem] bg-paper">
                {previews[0] ? (
                  <img src={previews[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CategoryArt category={form.category || 'other'} label="" className="h-full w-full" />
                )}
                {form.type && <TypeLabel type={form.type} className="absolute left-3 top-3" />}
                {!previews[0] && (
                  <span className="eyebrow absolute bottom-3 left-3 flex items-center gap-1.5 text-ink/45">
                    <Camera size={12} /> No photo yet
                  </span>
                )}
              </div>
              <div className="px-2.5 pb-2 pt-3.5">
                <div className="eyebrow flex justify-between text-muted">
                  <span>{form.category ? categoryLabel(form.category) : 'Category'}</span>
                  <span>Just now</span>
                </div>
                <p className={`mt-2 text-[1.15rem] font-semibold leading-snug tracking-[-0.02em] ${form.title ? '' : 'text-muted/60'}`}>{form.title || 'Your item title'}</p>
                <p className={`mt-1.5 line-clamp-2 text-sm leading-relaxed ${form.description ? 'text-muted' : 'text-muted/50'}`}>
                  {form.description || 'A short description of the item appears here.'}
                </p>
                <div className="perforation mt-4" />
                <p className="flex items-center gap-1.5 pt-3 text-xs text-muted">
                  <MapPin size={14} className="shrink-0" /> <span className="truncate">{previewLocation}</span>
                </p>
              </div>
            </div>

            <div className="card p-5 text-sm">
              <p className="font-semibold">Tips for a listing that works</p>
              <ul className="mt-3 space-y-2.5 text-muted">
                <li className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-lime-ink" aria-hidden /> Use a title people would search for, like “blue Milton bottle”.</li>
                <li className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-lime-ink" aria-hidden /> Mention colour, brand, size and any marks.</li>
                <li className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-lime-ink" aria-hidden /> Found something? Keep one detail back for your verification question.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

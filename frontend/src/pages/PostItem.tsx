import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImagePlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES, LOCATIONS } from '../lib/constants';
import type { ItemType } from '../lib/types';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
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
  return <p id={id} role="alert" className="mt-1.5 text-sm text-lost">{message}</p>;
}

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

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    let problem: string | null = null;
    const accepted: File[] = [];
    for (const file of picked) {
      if (!ALLOWED.includes(file.type)) problem = 'Only JPG, PNG or WebP images are allowed.';
      else if (file.size > MAX_BYTES) problem = 'Each photo must be smaller than 5 MB.';
      else accepted.push(file);
    }
    const merged = [...files, ...accepted];
    if (merged.length > MAX_FILES) problem = `You can add up to ${MAX_FILES} photos.`;
    setFiles(merged.slice(0, MAX_FILES));
    setFileError(problem);
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

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-medium sm:text-4xl">Post an item</h1>
      <p className="mt-2 text-muted">Clear details and a photo make it much more likely the item finds its way back.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-8">
        <div id="form-summary" tabIndex={-1} aria-live="polite">
          {errorList.length > 0 && (
            <div role="alert" className="rounded-md border border-lost bg-lost-soft p-4 text-sm text-lost">
              <p className="font-medium">Please fix {errorList.length === 1 ? 'this' : 'these'} before posting:</p>
              <ul className="mt-1 list-disc pl-5">
                {errorList.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>

        <fieldset>
          <legend className="label">What are you reporting?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['lost', 'found'] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border p-4 focus-within:ring-2 focus-within:ring-accent ${form.type === t ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-paper'}`}
              >
                <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => set('type', t)} className="sr-only" />
                <span className="block font-serif text-lg">{t === 'lost' ? 'I lost something' : 'I found something'}</span>
                <span className="mt-1 block text-sm text-muted">
                  {t === 'lost' ? 'Describe it so finders can recognise it.' : 'Add a private question so only the owner can claim it.'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" className="field" maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-err' : undefined} placeholder="e.g. Black leather wallet" />
          <FieldError id="title-err" message={errors.title} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="label">Category</label>
            <select id="category" className="field" value={form.category} onChange={(e) => set('category', e.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'category-err' : undefined}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FieldError id="category-err" message={errors.category} />
          </div>
          <div>
            <label htmlFor="date" className="label">{isFound ? 'Date found' : 'Date lost'}</label>
            <input id="date" type="date" className="field" max={localToday()} value={form.date} onChange={(e) => set('date', e.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-err' : undefined} />
            <FieldError id="date-err" message={errors.date} />
          </div>
        </div>

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
            <label htmlFor="placeDetail" className="label">More detail <span className="font-normal text-muted">(optional)</span></label>
            <input id="placeDetail" className="field" maxLength={80} value={form.placeDetail} onChange={(e) => set('placeDetail', e.target.value)} placeholder="e.g. second floor reading room" />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" rows={5} maxLength={1000} className="field" value={form.description} onChange={(e) => set('description', e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-err' : 'description-hint'} />
          <p id="description-hint" className="mt-1.5 text-xs text-muted">Colour, brand, size and any marks help. {isFound && 'Leave out details only the owner would know.'}</p>
          <FieldError id="description-err" message={errors.description} />
        </div>

        <div>
          <p className="label">Photos <span className="font-normal text-muted">(optional, up to {MAX_FILES})</span></p>
          <label htmlFor="photos" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-sm text-muted focus-within:ring-2 focus-within:ring-accent hover:bg-paper">
            <ImagePlus size={24} aria-hidden />
            <span>Add photos (JPG, PNG or WebP, up to 5 MB each)</span>
            <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} className="sr-only" />
          </label>
          {fileError && <p role="alert" className="mt-2 text-sm text-lost">{fileError}</p>}
          {previews.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-3">
              {previews.map((url, i) => (
                <li key={url} className="relative">
                  <img src={url} alt={`Selected photo ${i + 1}`} className="h-20 w-20 rounded-md border border-line object-cover" />
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))} aria-label={`Remove photo ${i + 1}`} className="absolute -right-2 -top-2 rounded-full border border-line bg-surface p-1 shadow-sm hover:bg-paper">
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isFound && (
          <fieldset className="space-y-6 rounded-lg border border-line bg-surface p-5">
            <legend className="px-2 font-serif text-lg">Private verification</legend>
            <p className="text-sm text-muted">Claimants will see only your question. The answer is never shown to anyone else.</p>
            <div>
              <label htmlFor="question" className="label">Question for the owner</label>
              <input id="question" className="field" maxLength={140} value={form.question} onChange={(e) => set('question', e.target.value)} aria-invalid={Boolean(errors.question)} aria-describedby={errors.question ? 'question-err' : undefined} placeholder="e.g. What is the wallpaper on the lock screen?" />
              <FieldError id="question-err" message={errors.question} />
            </div>
            <div>
              <label htmlFor="answer" className="label">Correct answer</label>
              <input id="answer" className="field" maxLength={140} value={form.answer} onChange={(e) => set('answer', e.target.value)} aria-invalid={Boolean(errors.answer)} aria-describedby={errors.answer ? 'answer-err' : undefined} autoComplete="off" />
              <FieldError id="answer-err" message={errors.answer} />
            </div>
          </fieldset>
        )}

        {submitError && <p role="alert" className="rounded-md border border-lost bg-lost-soft p-3 text-sm text-lost">{submitError}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="btn-primary h-11 px-6">{busy ? 'Posting…' : 'Post listing'}</button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary h-11 px-6">Cancel</button>
        </div>
      </form>
    </div>
  );
}

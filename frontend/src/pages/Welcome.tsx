import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, GraduationCap } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ACADEMIC_YEARS, BRANCHES, PROGRAMMES, SECTION_PATTERN, composeBio, formatAcademicLine } from '../lib/profile';

/**
 * First-run profile setup. The answers become structured profile fields and a readable bio,
 * so other members can recognise who they are dealing with.
 */
export default function Welcome() {
  const { user, profile, setProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get('next') ?? '/dashboard';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/welcome') ? rawNext : '/dashboard';

  const [name, setName] = useState('');
  const [programme, setProgramme] = useState('B.Tech');
  const [academicYear, setAcademicYear] = useState('');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');
  const [about, setAbout] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Complete your profile | ReturnIt';
    if (profile?.name) setName((n) => n || profile.name);
  }, [profile?.name]);

  if (!loading && !user) return <Navigate to="/signin" replace state={{ from: `/welcome?next=${encodeURIComponent(next)}` }} />;
  if (profile?.onboarded) return <Navigate to={next} replace />;

  const isStaff = programme === 'Faculty' || programme === 'Staff';
  const preview = academicYear && branch ? composeBio({ programme, academicYear: isStaff ? 'Not applicable' : academicYear, branch, section, about }) : '';

  function validate() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (!isStaff && !academicYear) e.academicYear = 'Choose your year.';
    if (!branch) e.branch = 'Choose your branch or department.';
    if (section && !SECTION_PATTERN.test(section.trim())) e.section = 'Use up to 6 letters or digits, for example B or G2.';
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const updated = await api.completeOnboarding({
        name: name.trim(),
        programme,
        academicYear: isStaff ? 'Not applicable' : academicYear,
        branch,
        section: section.trim(),
        about: about.trim(),
      });
      setProfile(updated);
      navigate(next, { replace: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${k}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger">
        <AlertCircle size={14} aria-hidden /> {errors[k]}
      </p>
    ) : null;

  return (
    <div className="container-page pb-24">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-12">
        <header className="lg:col-span-5">
          <span className="grid h-12 w-12 -rotate-6 place-items-center rounded-2xl bg-lime text-ink" aria-hidden>
            <GraduationCap size={22} />
          </span>
          <p className="eyebrow mt-6 text-muted">Step 1 of 1</p>
          <h1 className="mt-3 text-display-lg font-bold">Complete your profile</h1>
          <p className="mt-4 text-muted">
            Tell the community a little about yourself. Your year, branch and section appear on your profile so members can recognise you when returning an item. Your email address remains private.
          </p>

          <div className="card mt-8 p-5" aria-live="polite">
            <p className="eyebrow text-muted">Profile preview</p>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={name || user?.name || 'Member'} src={profile?.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold tracking-tight">{name || 'Your name'}</p>
                <p className="text-xs text-muted">{formatAcademicLine({ programme, academicYear: isStaff ? null : academicYear || null, branch: branch || null, section: section || null }) || 'Programme · Year · Branch'}</p>
              </div>
            </div>
            <p className={`mt-4 text-sm leading-relaxed ${preview ? 'text-ink-soft' : 'text-muted/60'}`}>{preview || 'Your bio is generated from your answers. You can edit it later from your profile.'}</p>
          </div>
        </header>

        <form onSubmit={submit} noValidate className="card space-y-6 p-6 sm:p-8 lg:col-span-7">
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" className="field" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-err' : undefined} />
            {err('name')}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="programme" className="label">Programme or role</label>
              <select id="programme" className="field" value={programme} onChange={(e) => setProgramme(e.target.value)}>
                {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {!isStaff && (
              <div>
                <label htmlFor="year" className="label">Year</label>
                <select id="year" className="field" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} aria-invalid={Boolean(errors.academicYear)} aria-describedby={errors.academicYear ? 'academicYear-err' : undefined}>
                  <option value="">Select your year</option>
                  {ACADEMIC_YEARS.filter((y) => y !== 'Not applicable').map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {err('academicYear')}
              </div>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-[1fr_9rem]">
            <div>
              <label htmlFor="branch" className="label">{isStaff ? 'Department' : 'Branch'}</label>
              <select id="branch" className="field" value={branch} onChange={(e) => setBranch(e.target.value)} aria-invalid={Boolean(errors.branch)} aria-describedby={errors.branch ? 'branch-err' : undefined}>
                <option value="">Select {isStaff ? 'a department' : 'your branch'}</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {err('branch')}
            </div>
            {!isStaff && (
              <div>
                <label htmlFor="section" className="label">Section <span className="optional">Optional</span></label>
                <input id="section" className="field uppercase" maxLength={6} value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. B" aria-invalid={Boolean(errors.section)} aria-describedby={errors.section ? 'section-err' : undefined} />
                {err('section')}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="about" className="label">Short introduction <span className="optional">Optional</span></label>
              <span className="font-mono text-[11px] text-muted" aria-hidden>{about.length}/280</span>
            </div>
            <textarea id="about" rows={3} maxLength={280} className="field" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="For example: usually in the Central Library on weekday evenings." />
            <p className="hint">Avoid sharing phone numbers or room numbers here. Use ReturnIt Messages to coordinate.</p>
          </div>

          {submitError && (
            <p role="alert" className="flex gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">
              <AlertCircle size={18} aria-hidden className="shrink-0" /> {submitError}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary btn-lg w-full sm:w-auto">
            {busy ? 'Saving…' : 'Save and continue'} <ArrowRight size={18} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

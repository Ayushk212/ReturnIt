import { Link } from 'react-router-dom';

const STEPS = [
  { title: 'Post the item', body: 'Describe what was lost or found, add a photo if you have one, and say where and when. Finders also write a private question that only the true owner could answer.' },
  { title: 'Send a request', body: 'Open a listing and send a request. Owners answer the finder’s question; finders say where they found the item and how they can hand it over.' },
  { title: 'Approval and contact', body: 'The person who posted the listing reviews the request. Only when they approve are email addresses shared, and only between those two people.' },
  { title: 'Meet and close the listing', body: 'Hand the item over in a public place on campus, then mark the listing as resolved so it leaves the board.' },
];

const GUIDELINES = [
  'Meet in a public, well-lit place on campus, such as the library entrance or the main building lobby.',
  'Never share OTPs, passwords or bank details. Nobody needs them to return an item.',
  'Do not put the answer to your verification question in the listing description.',
  'Report anything that feels wrong to a hostel warden or campus security.',
];

const FAQ = [
  { q: 'Who can use ReturnIt?', a: 'Anyone can browse the board. To open a listing, post, or send a request, you must sign in with an @mnnit.ac.in account.' },
  { q: 'Why do I have to sign in to open a listing?', a: 'It keeps the community accountable and stops the board from being scraped or used for spam.' },
  { q: 'When are my contact details shared?', a: 'Only after the owner of a listing approves a request, and only with the person who made it. They are never shown publicly.' },
  { q: 'What happens if nobody responds?', a: 'Open listings expire automatically after 90 days. You can post again at any time.' },
];

export default function Safety() {
  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-muted">How it works</p>
        <h1 className="mt-2 text-4xl font-medium sm:text-5xl">A simple process, built around trust.</h1>
        <p className="mt-4 text-lg text-muted">
          ReturnIt connects people who lost something with people who found it, without exposing anyone’s personal details along the way.
        </p>
      </header>

      <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-surface p-6">
            <span className="font-serif text-3xl text-muted">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="mt-3 text-xl font-medium">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="safety-heading">
          <h2 id="safety-heading" className="text-2xl font-medium">Safety guidelines</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {GUIDELINES.map((g) => (
              <li key={g} className="border-l-2 border-accent pl-4">{g}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-medium">Common questions</h2>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/dashboard" className="btn-primary">Browse listings</Link>
        <Link to="/post" className="btn-secondary">Post an item</Link>
      </div>
    </div>
  );
}

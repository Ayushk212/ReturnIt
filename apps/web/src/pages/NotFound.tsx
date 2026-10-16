import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-page py-24">
      <p className="text-sm font-medium text-muted">Error 404</p>
      <h1 className="mt-2 text-4xl font-medium">This page could not be found.</h1>
      <p className="mt-3 max-w-md text-muted">The link may be out of date, or the listing may have been removed.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">Go to the homepage</Link>
        <Link to="/dashboard" className="btn-secondary">Browse listings</Link>
      </div>
    </div>
  );
}

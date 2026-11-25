import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/"><Button>Back to home</Button></Link>
        <Link to="/track"><Button variant="outline">Check report status</Button></Link>
        <Link to="/report"><Button variant="outline">Report road damage</Button></Link>
      </div>
    </div>
  );
}

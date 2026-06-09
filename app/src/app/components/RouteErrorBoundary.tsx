import { useEffect } from 'react';
import { useNavigate, useRouteError } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { setRouteErrorNotice, storeErrorReport } from '../lib/errorReports';

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    const report = storeErrorReport(error);
    setRouteErrorNotice(`Something went wrong. Error report ${report.id} was saved locally.`);
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 1600);
    return () => window.clearTimeout(timer);
  }, [error, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-red-900/60 bg-red-950/20 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-800 bg-red-950 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-300">
          We saved an error report locally and will return you to the main page.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { consumeRouteErrorNotice } from '../lib/errorReports';

export default function RouteErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(consumeRouteErrorNotice());
  }, []);

  if (!message) return null;

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-red-900/70 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-2xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">{message}</div>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="rounded p-0.5 text-red-200 transition-colors hover:bg-red-900"
          aria-label="Dismiss error notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

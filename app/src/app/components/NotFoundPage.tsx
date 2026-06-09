import { ArrowLeft, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

type NotFoundPageProps = {
  audience: 'government' | 'public';
};

export default function NotFoundPage({ audience }: NotFoundPageProps) {
  const navigate = useNavigate();
  const homePath = audience === 'government' ? '/gov' : '/public';
  const portalName = audience === 'government' ? 'government dashboard' : 'public portal';

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-signal-brand">Error 404</div>
        <h1 className="mt-4 text-5xl font-bold text-zinc-100 sm:text-6xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-400">
          This page may have moved, been removed, or the address may be incorrect.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={homePath}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-signal-brand px-4 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            <Home className="h-4 w-4" />
            Back to {portalName}
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous page
          </button>
        </div>
      </div>
    </section>
  );
}

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Loader2, Lock, Radio, Shield, Users } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, saveAuthTokens } from '../../lib/auth';

type PortalKind = 'gov' | 'public';

type AuthUser = {
  actorType: string | null;
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
};

function portalFromTarget(target: string | null): PortalKind {
  if (target?.startsWith('/gov')) return 'gov';
  return 'public';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');
  const requestedPortal = searchParams.get('portal');
  const portal = (requestedPortal === 'gov' || requestedPortal === 'public' ? requestedPortal : portalFromTarget(redirectTarget)) as PortalKind;
  const redirectTo = redirectTarget || (portal === 'gov' ? '/gov' : '/public');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const portalCopy = useMemo(() => {
    if (portal === 'gov') {
      return {
        icon: Radio,
        title: 'Sign in to Command Centre',
        subtitle: 'Authenticate before opening the government operations dashboard.',
        accent: 'text-red-400',
        surface: 'border-red-900/50 bg-red-950/20',
      };
    }

    return {
      icon: Users,
      title: 'Sign in to Public Portal',
      subtitle: 'Authenticate before entering the citizen-facing portal experience.',
      accent: 'text-blue-400',
      surface: 'border-blue-900/50 bg-blue-950/20',
    };
  }, [portal]);

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (data?.user) {
          navigate(redirectTo, { replace: true });
        }
      })
      .catch(() => {
        // Intentionally ignore and keep the login form visible.
      });
  }, [navigate, redirectTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Unable to sign in';
        throw new Error(message);
      }

      saveAuthTokens(payload.tokens);
      navigate(redirectTo, { replace: true });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  const Icon = portalCopy.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center">
            <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to landing page
            </Link>

            <div className={`mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm ${portalCopy.surface}`}>
              <Icon className={`h-4 w-4 ${portalCopy.accent}`} />
              Protected access
            </div>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              {portalCopy.title}
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              {portalCopy.subtitle}
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-zinc-900 p-3">
                  <Shield className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <div className="font-semibold">SiGnal Access</div>
                  <div className="text-sm text-zinc-500">Backend-authenticated session</div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">Username or email</div>
                  <input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition-colors focus:border-red-500"
                    autoComplete="username"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition-colors focus:border-red-500"
                    autoComplete="current-password"
                  />
                </label>

                {error ? (
                  <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || !identifier.trim() || !password}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Sign in
                </button>
              </form>

              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                Redirect after login: <span className="text-zinc-200">{redirectTo}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

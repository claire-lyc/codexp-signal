import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Loader2, Lock, Radio, Shield, Users } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens, saveAuthTokens } from '../../lib/auth';

type PortalKind = 'gov' | 'public';
type AuthMode = 'login' | 'register';

type AuthUser = {
  actorType: string | null;
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  agencyId?: string | null;
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
  const redirectTo = portal === 'gov' ? '/gov' : (redirectTarget || '/public');
  const [mode, setMode] = useState<AuthMode>('login');

  const [displayName, setDisplayName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');

  const portalCopy = useMemo(() => {
    if (portal === 'gov') {
      return {
        icon: Radio,
        title: 'Log in to Command Centre',
        subtitle: 'Authenticate before opening the government operations dashboard.',
        accent: 'text-red-400',
        surface: 'border-red-900/50 bg-red-950/20',
      };
    }

    return {
      icon: Users,
      title: mode === 'register' ? 'Register for Public Portal' : 'Log in to Public Portal',
      subtitle: mode === 'register'
        ? 'Create a citizen account to submit reports, join the forum, and track updates.'
        : 'Authenticate before entering the citizen-facing portal experience.',
      accent: 'text-blue-400',
      surface: 'border-blue-900/50 bg-blue-950/20',
    };
  }, [mode, portal]);

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (data?.user) {
          const actorType = data.user.actorType;
          const canAccessRequestedPortal = portal === 'gov'
            ? actorType === 'government_user' || actorType === 'system'
            : actorType === 'citizen';

          if (canAccessRequestedPortal) {
            navigate(redirectTo, { replace: true });
            return;
          }

          setSessionNotice(
            portal === 'gov'
              ? 'This browser is currently signed in to a public account. Sign in with a government account to continue.'
              : 'This browser is currently signed in to a government account. Sign in with a public account to continue.',
          );
        }
      })
      .catch(() => {
        // Intentionally ignore and keep the login form visible.
      });
  }, [navigate, portal, redirectTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSessionNotice('');

    try {
      if (mode === 'register') {
        if (portal !== 'public') {
          throw new Error('Government accounts must be issued separately');
        }
        if (!displayName.trim()) {
          throw new Error('Name is required');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
      }

      const response = await fetch(apiUrl(mode === 'register' ? '/api/auth/register' : '/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'register'
            ? {
                email: identifier,
                password,
                displayName: displayName.trim(),
              }
            : { email: identifier, password },
        ),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : mode === 'register' ? 'Unable to register' : 'Unable to log in';
        throw new Error(message);
      }

      if (portal === 'gov' && payload.user?.actorType !== 'government_user' && payload.user?.actorType !== 'system') {
        throw new Error('This account cannot access the government portal');
      }

      if (portal === 'public' && payload.user?.actorType !== 'citizen') {
        throw new Error('This account cannot access the public portal');
      }

      saveAuthTokens(payload.tokens);
      if (payload.user) {
        localStorage.setItem('signal-current-user', JSON.stringify(payload.user));
      }
      const nextPath = portal === 'gov' ? '/gov' : redirectTo;
      navigate(nextPath, { replace: true });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : mode === 'register' ? 'Unable to register' : 'Unable to log in');
    } finally {
      setBusy(false);
    }
  };

  const Icon = portalCopy.icon;
  const handleUseDifferentAccount = () => {
    clearAuthTokens();
    setSessionNotice('');
    setError('');
    setDisplayName('');
    setIdentifier('');
    setPassword('');
    setConfirmPassword('');
  };

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

            {portal === 'public' ? (
              <div className="mt-6 inline-flex w-fit rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSessionNotice('');
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Register
                </button>
              </div>
            ) : (
              <p className="mt-6 text-sm text-zinc-500">Government accounts are issued separately.</p>
            )}
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
                {mode === 'register' ? (
                  <label className="block">
                    <div className="mb-2 text-sm text-zinc-400">Full name</div>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Enter your full name"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition-colors focus:border-red-500"
                      autoComplete="name"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">{mode === 'register' ? 'Email' : 'Username or email'}</div>
                  <input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={mode === 'register' ? 'Enter your email' : 'Enter your username or email'}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition-colors focus:border-red-500"
                    autoComplete={mode === 'register' ? 'email' : 'username'}
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
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                </label>

                {mode === 'register' ? (
                  <label className="block">
                    <div className="mb-2 text-sm text-zinc-400">Confirm password</div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition-colors focus:border-red-500"
                      autoComplete="new-password"
                    />
                  </label>
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                ) : null}

                {sessionNotice ? (
                  <div className="rounded-xl border border-yellow-800 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
                    <div>{sessionNotice}</div>
                    <button
                      type="button"
                      onClick={handleUseDifferentAccount}
                      className="mt-3 inline-flex rounded-lg border border-yellow-700 px-3 py-2 text-xs font-medium text-yellow-100 transition-colors hover:bg-yellow-900/40"
                    >
                      Use a different account
                    </button>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || !identifier.trim() || !password || (mode === 'register' && (!displayName.trim() || !confirmPassword))}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {mode === 'register' ? 'Register' : 'Log in'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

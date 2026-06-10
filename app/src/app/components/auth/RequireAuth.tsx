import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { fetchWithAuth } from '../../lib/api';
import { hasAuthToken } from '../../lib/auth';
import FloodDemoController from '../FloodDemoController';

type AuthState = 'checking' | 'allowed' | 'denied';

export default function RequireAuth() {
  const location = useLocation();
  const [state, setState] = useState<AuthState>(() => (hasAuthToken() ? 'checking' : 'denied'));

  useEffect(() => {
    if (!hasAuthToken()) {
      setState('denied');
      return;
    }

    let cancelled = false;

    fetchWithAuth('/api/auth/me')
      .then((response) => {
        if (!response.ok) throw new Error('Unauthorized');
        return response.json() as Promise<{ user: { actorType?: string | null } | null }>;
      })
      .then((data) => {
        const isGovRoute = location.pathname.startsWith('/gov');
        const actorType = data.user?.actorType;
        const allowed = isGovRoute
          ? actorType === 'government_user' || actorType === 'system'
          : actorType === 'citizen';
        if (!allowed) throw new Error('Unauthorized');
        if (!cancelled) setState('allowed');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">
        Checking access...
      </div>
    );
  }

  if (state === 'denied') {
    const redirect = `${location.pathname}${location.search}`;
    const portal = location.pathname.startsWith('/gov') ? 'gov' : 'public';
    return <Navigate to={`/login?portal=${portal}&redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return (
    <>
      <FloodDemoController />
      <Outlet />
    </>
  );
}

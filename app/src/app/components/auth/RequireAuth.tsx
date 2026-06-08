import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens, hasAuthToken } from '../../lib/auth';

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

    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Unauthorized');
        if (!cancelled) setState('allowed');
      })
      .catch(() => {
        clearAuthTokens();
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

  return <Outlet />;
}

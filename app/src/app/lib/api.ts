import { useEffect, useState } from 'react';
import cachedExternalDashboard from '../../data/dashboard-data.json';
import dashboardUiData from '../../data/dashboard-ui-data.json';
import { clearAuthTokens, getAccessToken, getRefreshToken, saveAuthTokens } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const API_REFRESH_INTERVAL_MS = Number(import.meta.env.VITE_API_REFRESH_MS ?? 15000);

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const fallbackResponses: Record<string, unknown> = {
  '/api/dashboard/cached-external': cachedExternalDashboard,
  '/api/gov/cybersecurity': dashboardUiData.cybersecurity,
  '/api/citizen/home': dashboardUiData.publicHome,
  '/api/public/home': dashboardUiData.publicHome,
  '/api/citizen/incidents': {
    incidents: dashboardUiData.publicIncidents,
    pastIncidents: dashboardUiData.pastIncidents,
  },
  '/api/public/incidents': {
    incidents: dashboardUiData.publicIncidents,
    pastIncidents: dashboardUiData.pastIncidents,
  },
  '/api/gov/recommendations': { items: dashboardUiData.recommendations },
  '/api/recommendations': { items: dashboardUiData.recommendations },
  '/api/gov/sentiment': dashboardUiData.publicSentiment,
  '/api/sentiment': dashboardUiData.publicSentiment,
  '/api/gov/historical': { items: dashboardUiData.historicalCrises },
  '/api/historical': { items: dashboardUiData.historicalCrises },
  '/api/gov/alerts': { items: dashboardUiData.govAlerts },
  '/api/alerts': { items: dashboardUiData.govAlerts },
};

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

let refreshPromise: Promise<boolean> | null = null;

function fallbackFor<T>(path: string): T | null {
  const normalizedPath = path.split('?')[0];
  return (fallbackResponses[normalizedPath] as T | undefined) ?? null;
}

function isAuthPath(url: string) {
  return ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']
    .some((path) => url.includes(path));
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthTokens();
      return false;
    }

    try {
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        clearAuthTokens();
        return false;
      }

      const payload = await response.json() as { tokens?: { accessToken: string; refreshToken?: string } };
      if (!payload.tokens?.accessToken) {
        clearAuthTokens();
        return false;
      }

      saveAuthTokens(payload.tokens);
      return true;
    } catch {
      clearAuthTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchWithAuth(input: string, init: RequestInit = {}, allowRefresh = true) {
  const url = input.startsWith('http://') || input.startsWith('https://') ? input : apiUrl(input);
  const headers = new Headers(init.headers ?? {});
  const accessToken = getAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(url, { ...init, headers });
  if (response.status !== 401 || !allowRefresh || isAuthPath(url)) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) return response;

  const retryHeaders = new Headers(init.headers ?? {});
  const nextAccessToken = getAccessToken();
  if (nextAccessToken) {
    retryHeaders.set('Authorization', `Bearer ${nextAccessToken}`);
  }

  response = await fetch(url, { ...init, headers: retryHeaders });
  return response;
}

export function useApi<T>(path: string, refreshMs = API_REFRESH_INTERVAL_MS): ApiState<T> {
  const fallback = fallbackFor<T>(path);
  const [state, setState] = useState<ApiState<T>>({
    data: fallback,
    loading: !fallback,
    error: null,
  });

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const fallback = fallbackFor<T>(path);

    const load = (quiet = false) => {
      controller?.abort();
      controller = new AbortController();

      if (!quiet) {
        setState({ data: fallback, loading: !fallback, error: null });
      }

      fetchWithAuth(path, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return response.json() as Promise<T>;
        })
        .then((data) => {
          if (!active) return;
          setState({ data, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (!active || controller?.signal.aborted) return;
          if (fallback) {
            setState({ data: fallback, loading: false, error: null });
            return;
          }
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Request failed',
          });
        });
    };

    load(false);
    const timer = refreshMs > 0 ? window.setInterval(() => load(true), refreshMs) : undefined;

    return () => {
      active = false;
      controller?.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [path, refreshMs]);

  return state;
}

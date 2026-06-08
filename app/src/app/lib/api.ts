import { useEffect, useState } from 'react';
import cachedExternalDashboard from '../../data/dashboard-data.json';
import dashboardUiData from '../../data/dashboard-ui-data.json';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const API_REFRESH_INTERVAL_MS = Number(import.meta.env.VITE_API_REFRESH_MS ?? 15000);

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const fallbackResponses: Record<string, unknown> = {
  '/api/dashboard/cached-external': cachedExternalDashboard,
  '/api/gov/overview': {
    crises: [],
    alerts: dashboardUiData.govAlerts,
    overview: {
      crisisCards: dashboardUiData.crisisCards,
      incidentTrend: dashboardUiData.incidentTrend,
      riskSummary: dashboardUiData.riskSummary,
    },
  },
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

function fallbackFor<T>(path: string): T | null {
  const normalizedPath = path.split('?')[0];
  return (fallbackResponses[normalizedPath] as T | undefined) ?? null;
}

function authHeaders() {
  const token = window.localStorage.getItem('signal-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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

      fetch(apiUrl(path), { headers: authHeaders(), signal: controller.signal })
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


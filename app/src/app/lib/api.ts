import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function useApi<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setState({ data: null, loading: true, error: null });

    fetch(apiUrl(path), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<T>;
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Request failed',
        });
      });

    return () => controller.abort();
  }, [path]);

  return state;
}


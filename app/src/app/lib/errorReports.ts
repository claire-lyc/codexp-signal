const errorReportsKey = 'signal-error-reports';
const routeErrorNoticeKey = 'signal-route-error-notice';

export type StoredErrorReport = {
  id: string;
  path: string;
  message: string;
  stack?: string;
  createdAt: string;
};

export function storeErrorReport(error: unknown, path = window.location.pathname) {
  const report: StoredErrorReport = {
    id: `ERR-${Date.now().toString(36)}`,
    path,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(localStorage.getItem(errorReportsKey) ?? '[]') as StoredErrorReport[];
    localStorage.setItem(errorReportsKey, JSON.stringify([report, ...existing].slice(0, 20)));
  } catch {
    localStorage.setItem(errorReportsKey, JSON.stringify([report]));
  }

  return report;
}

export function setRouteErrorNotice(message: string) {
  sessionStorage.setItem(routeErrorNoticeKey, message);
}

export function consumeRouteErrorNotice() {
  const message = sessionStorage.getItem(routeErrorNoticeKey);
  if (message) sessionStorage.removeItem(routeErrorNoticeKey);
  return message;
}

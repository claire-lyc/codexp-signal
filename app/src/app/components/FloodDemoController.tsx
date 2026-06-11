import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/api';

type DemoResponse = {
  accepted: boolean;
  reportIds?: string[];
  forumPostIds?: string[];
  error?: string;
};

export const floodDemoUpdatedEvent = 'signal:flood-demo-updated';

export default function FloodDemoController() {
  const [message, setMessage] = useState('');
  const refreshTimer = useRef<number | null>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => {
    const showMessage = (nextMessage: string) => {
      setMessage(nextMessage);
      if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(() => setMessage(''), 2600);
    };

    const refreshDemoViews = () => {
      if (refreshTimer.current !== null) window.clearInterval(refreshTimer.current);
      window.dispatchEvent(new Event(floodDemoUpdatedEvent));
      refreshTimer.current = window.setInterval(
        () => window.dispatchEvent(new Event(floodDemoUpdatedEvent)),
        250,
      );
      window.setTimeout(() => {
        if (refreshTimer.current !== null) {
          window.clearInterval(refreshTimer.current);
          refreshTimer.current = null;
        }
        window.dispatchEvent(new Event(floodDemoUpdatedEvent));
      }, 2500);
    };

    const request = async (action: 'influx' | 'clear') => {
      try {
        const response = await fetchWithAuth(`/api/demo/boon-lay-flood/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: action === 'influx' ? JSON.stringify({ reset: true }) : undefined,
        });
        const payload = await response.json() as DemoResponse;
        if (!response.ok) {
          showMessage(payload.error ?? 'Boon Lay demo action failed. Check that the backend was restarted.');
          return;
        }

        refreshDemoViews();
        if (action === 'clear') {
          showMessage('Boon Lay flood demo data cleared.');
          return;
        }

        showMessage(`Seeded Boon Lay flood influx: ${payload.reportIds?.length ?? 0} reports.`);
      } catch {
        showMessage('Boon Lay demo controller could not reach the backend.');
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'p' && key !== 'o') return;
      event.preventDefault();
      if (event.repeat) return;
      void request(key === 'p' ? 'influx' : 'clear');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (refreshTimer.current !== null) window.clearInterval(refreshTimer.current);
      if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-blue-500/40 bg-zinc-950/95 px-4 py-3 text-sm text-zinc-100 shadow-2xl">
      {message}
    </div>
  );
}

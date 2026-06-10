import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/api';

type DemoFrame = {
  id: string;
  label: string;
};

type DemoResponse = {
  accepted: boolean;
  reason?: 'streaming' | 'complete' | null;
  state: {
    currentFrame: DemoFrame | null;
    nextFrame: DemoFrame | null;
  };
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

    const refreshDuringStream = () => {
      if (refreshTimer.current !== null) window.clearInterval(refreshTimer.current);
      window.dispatchEvent(new Event(floodDemoUpdatedEvent));
      refreshTimer.current = window.setInterval(
        () => window.dispatchEvent(new Event(floodDemoUpdatedEvent)),
        100,
      );
      window.setTimeout(() => {
        if (refreshTimer.current !== null) {
          window.clearInterval(refreshTimer.current);
          refreshTimer.current = null;
        }
        window.dispatchEvent(new Event(floodDemoUpdatedEvent));
      }, 1250);
    };

    const request = async (action: 'advance' | 'reset') => {
      try {
        const response = await fetchWithAuth(`/api/demo/flood/${action}`, { method: 'POST' });
        const payload = await response.json() as DemoResponse;
        if (!response.ok) {
          showMessage(payload.reason === 'streaming'
            ? 'The current flood frame is still loading.'
            : 'The flood demo is already at its final frame.');
          return;
        }

        if (action === 'reset') {
          window.dispatchEvent(new Event(floodDemoUpdatedEvent));
          showMessage('Flood demo reset. Press Ctrl+P to load Frame 1.');
          return;
        }

        refreshDuringStream();
        showMessage(`Loading ${payload.state.currentFrame?.label ?? 'next flood frame'}...`);
      } catch {
        showMessage('Flood demo controller could not reach the backend.');
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'p' && key !== 'o') return;
      event.preventDefault();
      if (event.repeat) return;
      void request(key === 'p' ? 'advance' : 'reset');
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

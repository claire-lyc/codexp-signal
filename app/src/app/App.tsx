import { RouterProvider } from 'react-router';
import { useEffect } from 'react';
import { router } from './routes';

const routeFallback = (
  <div className="min-h-screen bg-zinc-950 text-zinc-400 grid place-items-center">
    Loading...
  </div>
);

export default function App() {
  useEffect(() => {
    localStorage.removeItem('signal-theme');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div className="dark">
      <RouterProvider router={router} fallbackElement={routeFallback} />
    </div>
  );
}

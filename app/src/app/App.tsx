import { RouterProvider } from 'react-router';
import { router } from './routes';

const routeFallback = (
  <div className="min-h-screen bg-zinc-950 text-zinc-400 grid place-items-center">
    Loading...
  </div>
);

export default function App() {
  return (
    <div className="dark">
      <RouterProvider router={router} fallbackElement={routeFallback} />
    </div>
  );
}

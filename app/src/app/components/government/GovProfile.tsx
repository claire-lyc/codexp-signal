import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, LogOut, Shield, UserCircle } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens } from '../../lib/auth';

type ProfileUser = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  tags: string[];
};

export default function GovProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<{ user: ProfileUser | null }>;
      })
      .then((data) => {
        setUser(data.user);
        setError(null);
      })
      .catch((caught: unknown) => {
        setUser(null);
        setError(caught instanceof Error ? caught.message : 'Unable to load profile');
      });
  }, []);

  const logout = () => {
    clearAuthTokens();
    navigate('/login?portal=gov&redirect=%2Fgov');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/gov" className="flex items-center gap-3 text-zinc-300 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back to command centre</span>
          </Link>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold">SiGnal</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Government Profile</h1>
          <p className="mt-2 text-zinc-400">Current signed-in operator and access tag</p>
        </div>

        <section className="max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-950 text-red-300">
              <UserCircle className="h-8 w-8" />
            </div>
            <div>
              <div className="text-lg font-semibold">{user?.displayName ?? user?.username ?? 'Not signed in'}</div>
              <div className="text-sm text-zinc-500">{user?.email ?? error ?? 'No active token found'}</div>
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow label="User" value={user?.username ?? user?.email ?? 'Not signed in'} />
            <InfoRow label="Role" value={user?.role ?? 'None'} />
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Tag</div>
              <div className="flex flex-wrap gap-2">
                {(user?.tags?.length ? user.tags : ['No tag']).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-blue-800 bg-blue-950 px-2.5 py-1 text-sm text-blue-300">
                    <Shield className="h-3.5 w-3.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </section>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">{value}</div>
    </div>
  );
}

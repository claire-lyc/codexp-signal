import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, AlertTriangle, ArrowLeft, Bell, LogOut, Save, Shield, UserCircle } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens } from '../../lib/auth';

type ProfileUser = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  tags: string[];
};

type Preferences = {
  alertNotifications: boolean;
  replyNotifications: boolean;
  agencyPingNotifications: boolean;
  volunteerNotifications: boolean;
  smsEnabled: boolean;
  phoneNumber: string | null;
};

export default function GovProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [phoneInvalid, setPhoneInvalid] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/auth/profile'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<{ user: ProfileUser | null; preferences: Preferences }>;
      })
      .then((data) => {
        setUser(data.user);
        setPreferences(data.preferences);
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

  const savePreferences = async () => {
    if (!preferences) return;
    const nextPhoneInvalid = preferences.smsEnabled && !isValidPhone(preferences.phoneNumber ?? '');
    setPhoneInvalid(nextPhoneInvalid);
    if (nextPhoneInvalid) {
      setNotice('Enter a valid phone number for SMS notifications.');
      return;
    }
    const response = await fetch(apiUrl('/api/auth/profile/preferences'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ...preferences, phoneNumber: preferences.smsEnabled ? preferences.phoneNumber : null }),
    });
    if (!response.ok) {
      setPhoneInvalid(true);
      setNotice('Enter a valid phone number for SMS notifications.');
      return;
    }
    const data = await response.json() as { preferences: Preferences };
    setPreferences(data.preferences);
    setPhoneInvalid(false);
    setNotice('Preferences saved.');
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

        {notice && <div className="mb-5 max-w-xl rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3 text-sm text-blue-300">{notice}</div>}

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

        {preferences && (
          <section className="mt-6 max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-blue-400" />Notification Preferences</h2>
            <div className="grid gap-3">
              <Toggle label="Alerts" checked={preferences.alertNotifications} onChange={(value) => setPreferences({ ...preferences, alertNotifications: value })} />
              <Toggle label="Replies" checked={preferences.replyNotifications} onChange={(value) => setPreferences({ ...preferences, replyNotifications: value })} />
              <Toggle label="Agency pings" checked={preferences.agencyPingNotifications} onChange={(value) => setPreferences({ ...preferences, agencyPingNotifications: value })} />
              <Toggle label="Volunteer work" checked={preferences.volunteerNotifications} onChange={(value) => setPreferences({ ...preferences, volunteerNotifications: value })} />
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <Toggle label="Notify via SMS" checked={preferences.smsEnabled} onChange={(value) => {
                  setPhoneInvalid(false);
                  setPreferences({ ...preferences, smsEnabled: value, phoneNumber: value ? preferences.phoneNumber : null });
                }} />
                {preferences.smsEnabled && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Phone number</label>
                    <div className="relative">
                      {phoneInvalid && <AlertCircle className="absolute left-3 top-2.5 h-4 w-4 text-red-400" />}
                      <input
                        value={preferences.phoneNumber ?? ''}
                        onChange={(event) => {
                          setPhoneInvalid(false);
                          setPreferences({ ...preferences, phoneNumber: event.target.value });
                        }}
                        placeholder="+65 9123 4567"
                        className={`w-full rounded-lg border bg-zinc-800 py-2 pr-3 text-sm outline-none focus:border-blue-500 ${phoneInvalid ? 'border-red-600 pl-9' : 'border-zinc-700 px-3'}`}
                      />
                    </div>
                    {phoneInvalid && <div className="mt-1 text-xs text-red-300">Try again with a valid phone number.</div>}
                  </div>
                )}
              </div>
            </div>
            <button onClick={savePreferences} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
              <Save className="h-4 w-4" />Save Preferences
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
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

function isValidPhone(value: string) {
  return /^\+?[0-9][0-9\s-]{6,20}$/.test(value.trim());
}

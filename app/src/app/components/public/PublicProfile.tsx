import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, Bell, LogOut, Save, Shield, UserCircle } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens } from '../../lib/auth';

type Preferences = {
  alertNotifications: boolean;
  replyNotifications: boolean;
  agencyPingNotifications: boolean;
  volunteerNotifications: boolean;
  smsEnabled: boolean;
  phoneNumber: string | null;
};

type ProfileResponse = {
  user: { displayName: string | null; username: string | null; email: string | null; tags: string[] };
  preferences: Preferences;
};

export default function PublicProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notice, setNotice] = useState('');
  const [phoneInvalid, setPhoneInvalid] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/auth/profile'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Profile unavailable');
        return response.json() as Promise<ProfileResponse>;
      })
      .then((data) => {
        setProfile(data);
        setPreferences(data.preferences);
      })
      .catch(() => setNotice('Unable to load profile.'));
  }, []);

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

  const logout = () => {
    clearAuthTokens();
    navigate('/login?portal=public&redirect=%2Fpublic');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-1 text-zinc-400">Notification and SMS settings</p>
      </div>

      {notice && <div className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3 text-sm text-blue-300">{notice}</div>}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-950 text-blue-300">
            <UserCircle className="h-8 w-8" />
          </div>
          <div>
            <div className="text-lg font-semibold">{profile?.user.displayName ?? profile?.user.username ?? 'Citizen'}</div>
            <div className="text-sm text-zinc-500">{profile?.user.email ?? 'Signed in citizen'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(profile?.user.tags?.length ? profile.user.tags : ['Citizen']).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-blue-800 bg-blue-950 px-2.5 py-1 text-sm text-blue-300">
              <Shield className="h-3.5 w-3.5" />
              {tag}
            </span>
          ))}
        </div>
      </section>

      {preferences && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-blue-400" />Notifications</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Alerts" checked={preferences.alertNotifications} onChange={(value) => setPreferences({ ...preferences, alertNotifications: value })} />
            <Toggle label="Replies" checked={preferences.replyNotifications} onChange={(value) => setPreferences({ ...preferences, replyNotifications: value })} />
            <Toggle label="Agency pings" checked={preferences.agencyPingNotifications} onChange={(value) => setPreferences({ ...preferences, agencyPingNotifications: value })} />
            <Toggle label="Volunteer work" checked={preferences.volunteerNotifications} onChange={(value) => setPreferences({ ...preferences, volunteerNotifications: value })} />
          </div>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
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
          <button onClick={savePreferences} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
            <Save className="h-4 w-4" />Save Preferences
          </button>
        </section>
      )}

      <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700">
        <LogOut className="h-4 w-4" />Log out
      </button>
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

function isValidPhone(value: string) {
  return /^\+?[0-9][0-9\s-]{6,20}$/.test(value.trim());
}

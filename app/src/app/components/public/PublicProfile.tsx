import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
  user: {
    actorType?: string;
    displayName: string | null;
    username: string | null;
    email: string | null;
    role?: string | null;
    agencyCode?: string | null;
    tags: string[];
  } | null;
  preferences?: Preferences;
};

const agencyNames: Record<string, string> = {
  MOH: 'Ministry of Health',
  PUB: 'Public Utilities Board',
  LTA: 'Land Transport Authority',
  SPF: 'Singapore Police Force',
  SCDF: 'Singapore Civil Defence Force',
  NEA: 'National Environment Agency',
  CSA: 'Cyber Security Agency of Singapore',
  MSF: 'Ministry of Social and Family Development',
  'Enterprise SG': 'Enterprise Singapore',
  'GOV-OPS': 'Government Operations',
};

const tabs = [
  { id: 'details', label: 'Profile details', icon: UserCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type TabId = typeof tabs[number]['id'];

export default function PublicProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromSearch(searchParams.get('tab'));
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
        setPreferences(data.preferences ?? null);
        setNotice('');
      })
      .catch(() => setNotice('Unable to load account settings.'));
  }, []);

  const logout = () => {
    clearAuthTokens();
    navigate('/login?portal=public&redirect=%2Fpublic');
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
    setNotice('Notification settings saved.');
  };

  const user = profile?.user;
  const isGovernmentUser = user?.actorType === 'government_user';
  const agencyCode = user?.agencyCode ?? null;
  const agencyName = agencyCode ? agencyNames[agencyCode] ?? agencyCode : null;
  const role = user?.role && user.role !== agencyCode ? user.role : null;
  const profileName = user?.displayName ?? user?.username ?? user?.email ?? (isGovernmentUser ? 'Government User' : 'Citizen');
  const profileSubtitle = isGovernmentUser
    ? `${agencyName ?? 'Government agency'}${role ? ` - ${role}` : ''}`
    : user?.email ?? 'Signed in citizen';
  const profileTags = user?.tags?.length
    ? user.tags.map((tag) => agencyNames[tag] ?? tag)
    : [isGovernmentUser ? agencyName ?? role ?? 'Government agency' : 'Citizen'];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 lg:sticky lg:top-24 lg:self-start">
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSearchParams(tab.id === 'details' ? {} : { tab: tab.id })}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  activeTab === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-blue-400' : 'text-zinc-500'}`} />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-300 transition-colors hover:bg-red-950/40 hover:text-red-200"
          >
            <LogOut className="h-5 w-5 text-red-400" />
            Log out
          </button>
        </nav>
      </aside>

      <main className="min-w-0 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="mt-1 text-zinc-400">Manage profile details, notification preferences, and sign-out.</p>
        </div>

        {notice && <div className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3 text-sm text-blue-300">{notice}</div>}

        {activeTab === 'details' && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-5 text-xl font-semibold">Profile details</h2>
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-950 text-blue-300">
                <UserCircle className="h-8 w-8" />
              </div>
              <div>
                <div className="text-lg font-semibold">{profileName}</div>
                <div className="text-sm text-zinc-500">{profileSubtitle}</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Username" value={user?.username ?? 'Not set'} />
              <InfoRow label="Email" value={user?.email ?? 'Not set'} />
              <InfoRow label="Role" value={role ?? (isGovernmentUser ? 'Government user' : 'Citizen')} />
              <InfoRow label="Agency" value={agencyName ?? 'None'} />
            </div>
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Tags</div>
              <div className="flex flex-wrap gap-2">
                {profileTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-blue-800 bg-blue-950 px-2.5 py-1 text-sm text-blue-300">
                    <Shield className="h-3.5 w-3.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'notifications' && preferences && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Bell className="h-5 w-5 text-blue-400" />Notifications</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label="Alerts" checked={preferences.alertNotifications} onChange={(value) => setPreferences({ ...preferences, alertNotifications: value })} />
              <Toggle label="Replies" checked={preferences.replyNotifications} onChange={(value) => setPreferences({ ...preferences, replyNotifications: value })} />
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
              <Save className="h-4 w-4" />Save Settings
            </button>
          </section>
        )}
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function tabFromSearch(value: string | null): TabId {
  return tabs.some((tab) => tab.id === value) ? value as TabId : 'details';
}

function isValidPhone(value: string) {
  return /^\+?[0-9][0-9\s-]{6,20}$/.test(value.trim());
}

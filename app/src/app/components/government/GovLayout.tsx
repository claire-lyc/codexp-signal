import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Cloud,
  Package,
  Zap,
  Shield,
  MessageSquare,
  Reply,
  Users,
  Brain,
  History,
  Radio,
  Bell,
  AlertTriangle,
  Ticket,
  UserCircle,
  LogOut,
  Settings,
  Languages,
  ChevronRight,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders, clearAuthTokens } from '../../lib/auth';

type ProfileUser = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  agencyCode?: string | null;
};

const navSections = [
  {
    title: 'Command',
    items: [
      { path: '/gov', label: 'Overview', icon: LayoutDashboard },
      { path: '/gov/form-handling', label: 'Form Handling', icon: Ticket },
      { path: '/gov/broadcast', label: 'Broadcast Centre', icon: Radio },
    ],
  },
  {
    title: 'Risk Monitoring',
    items: [
      { path: '/gov/pandemic', label: 'Health & Diseases', icon: Activity },
      { path: '/gov/weather', label: 'Weather & Climate', icon: Cloud },
      { path: '/gov/supply-chain', label: 'Supply Chain', icon: Package },
      { path: '/gov/infrastructure', label: 'Infrastructure', icon: Zap },
      { path: '/gov/cybersecurity', label: 'Cybersecurity', icon: Shield },
    ],
  },
  {
    title: 'Public Coordination',
    items: [
      { path: '/gov/public-sentiment', label: 'Public Sentiment', icon: MessageSquare },
      { path: '/gov/forum', label: 'Community Forum', icon: Reply },
      { path: '/gov/volunteers', label: 'Volunteers & Resources', icon: Users },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/gov/ai-recommendations', label: 'Data Projections', icon: Brain },
      { path: '/gov/historical', label: 'Historical Analysis', icon: History },
    ],
  },
];

export default function GovLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileModalRef = useRef<HTMLDivElement | null>(null);
  const currentTime = new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Profile API unavailable');
        return response.json() as Promise<{ user: ProfileUser | null }>;
      })
      .then((data) => setProfileUser(data.user))
      .catch(() => setProfileUser(null));
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      const clickedProfileButton = profileRef.current?.contains(target);
      const clickedProfileModal = profileModalRef.current?.contains(target);

      if (profileOpen && !clickedProfileButton && !clickedProfileModal) {
        setProfileOpen(false);
    }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [notificationsOpen, profileOpen]);

  const profileName = profileUser?.displayName ?? profileUser?.username ?? profileUser?.email ?? 'Authorized User';
  const profileSubtext = profileUser?.agencyCode ?? profileUser?.role ?? 'Government account';
  const profileEmail = profileUser?.email ?? 'Not provided';
  const profileAgency = profileUser?.agencyCode ?? 'All Agencies';

  const logout = () => {
    clearAuthTokens();
    setProfileOpen(false);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-6 pb-7 pt-6">
          <Link to="/" className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-signal-brand" />
            <div>
              <h1 className="font-bold text-lg"><span className="text-signal-brand">S</span>i<span className="text-signal-brand">G</span>nal</h1>

              <p className="text-xs text-zinc-500">Crisis Command</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-7">
            {navSections.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                          isActive
                            ? 'bg-zinc-800 text-white ring-1 ring-zinc-700'
                            : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-signal-brand' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div ref={profileRef} className="relative border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/70"
            aria-label="Open profile menu"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <UserCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-100">{profileName}</div>
              <div className="truncate text-xs text-zinc-500">{profileSubtext}</div>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-500" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm text-zinc-400">{currentTime}</div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span>Active Crises: <span className="text-white font-medium">3</span></span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div ref={notificationsRef} className="relative">
                <button onClick={() => setNotificationsOpen((open) => !open)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors relative">
                  <Bell className="w-5 h-5 text-zinc-400" />
                  <div className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></div>
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                    <NotificationLink to="/gov/form-handling?ticket=TKT-0040" icon={Ticket} title="Agency ping" text="PUB was pinged on flood report TKT-0040" onClick={() => setNotificationsOpen(false)} />
                    <NotificationLink to="/gov/broadcast" icon={Radio} title="Active broadcast" text="Flash flood warning remains ongoing" onClick={() => setNotificationsOpen(false)} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-950 border border-green-800 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-green-400">All Systems Active</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div
            ref={profileModalRef}
            className="grid w-full max-w-3xl grid-cols-[220px_1fr] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <aside className="border-r border-zinc-800 bg-zinc-950/70 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-3 text-zinc-100">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700">
                    <Settings className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold">General</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-zinc-500">
                  <UserCircle className="h-5 w-5" />
                  <span className="text-sm font-semibold">Profile</span>
                </div>
              </div>
            </aside>

            <section className="relative p-8">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="absolute right-5 top-5 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close profile settings"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="mb-8 text-2xl font-semibold text-zinc-100">General</h2>
              <div className="space-y-6">
                <ProfileSettingRow label="Name" value={profileName} />
                <ProfileSettingRow label="Email" value={profileEmail} muted={profileEmail === 'Not provided'} />
                <ProfileSettingRow label="Agency" value={profileAgency} />
                <div className="grid grid-cols-[160px_1fr] items-center gap-6">
                  <div className="text-sm font-medium text-zinc-300">Language</div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="flex min-w-40 items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200"
                    >
                      <span>English</span>
                      <Languages className="h-4 w-4 text-zinc-500" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end border-t border-zinc-800 pt-5">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSettingRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-6">
      <div className="text-sm font-medium text-zinc-300">{label}</div>
      <div className={`truncate text-right text-sm ${muted ? 'text-zinc-600' : 'text-zinc-200'}`}>{value}</div>
    </div>
  );
}

function NotificationLink({ to, icon: Icon, title, text, onClick }: { to: string; icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-800">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
      <span>
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-xs text-zinc-500">{text}</span>
      </span>
    </Link>
  );
}

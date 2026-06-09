import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Cloud,
  Package,
  Zap,
  Shield,
  MessageSquare,
  Users,
  Brain,
  History,
  Radio,
  Bell,
  Search,
  AlertTriangle,
  Ticket,
  UserCircle,
  LogOut,
  Settings,
  ChevronRight,
  Reply,
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

type NotificationItem = {
  id: string;
  type: 'alert' | 'reply' | 'agency_ping' | 'volunteer';
  title: string;
  text: string;
  to: string;
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
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
    loadGovNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  const profileName = profileUser?.displayName ?? profileUser?.username ?? profileUser?.email ?? 'Authorized User';
  const profileSubtext = profileUser?.agencyCode ?? profileUser?.role ?? 'Government account';

  const logout = () => {
    clearAuthTokens();
    setProfileOpen(false);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <Link to="/" className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-signal-brand" />
            <div>
              <h1 className="font-bold text-lg">SiGnal</h1>
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

        <div className="relative border-t border-zinc-800 p-3">
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
          {profileOpen && (
            <div className="absolute bottom-3 left-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
              <Link
                to="/gov-profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
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
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <Search className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen((open) => !open);
                    void loadGovNotifications().then(setNotifications).catch(() => setNotifications([]));
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors relative"
                >
                  <Bell className="w-5 h-5 text-zinc-400" />
                  {notifications.length > 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></div>}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                    {notifications.length ? notifications.map((item) => (
                      <NotificationLink
                        key={item.id}
                        id={item.id}
                        type={item.type}
                        to={item.to}
                        title={item.title}
                        text={item.text}
                        onClick={() => {
                          setNotificationsOpen(false);
                          setNotifications((current) => current.filter((notification) => notification.id !== item.id));
                        }}
                      />
                    )) : (
                      <div className="px-3 py-4 text-sm text-zinc-500">No notifications right now.</div>
                    )}
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
    </div>
  );
}

async function loadGovNotifications(): Promise<NotificationItem[]> {
  const response = await fetch(apiUrl('/api/notifications'), { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json() as { items: NotificationItem[] };
  return data.items;
}

async function markNotificationRead(id: string) {
  await fetch(apiUrl(`/api/notifications/${id}/read`), {
    method: 'PATCH',
    headers: authHeaders(),
  });
}

function NotificationLink({ id, type, to, title, text, onClick }: { id: string; type: NotificationItem['type']; to: string; title: string; text: string; onClick: () => void }) {
  const Icon = notificationIcon(type);
  return (
    <Link
      to={to}
      onClick={() => {
        void markNotificationRead(id);
        onClick();
      }}
      className="flex items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-800"
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
      <span>
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-xs text-zinc-500">{text}</span>
      </span>
    </Link>
  );
}

function notificationIcon(type: NotificationItem['type']): LucideIcon {
  if (type === 'reply') return Reply;
  if (type === 'agency_ping') return Ticket;
  if (type === 'volunteer') return Users;
  return Radio;
}

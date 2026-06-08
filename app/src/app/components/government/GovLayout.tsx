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

const navItems = [
  { path: '/gov', label: 'Overview', icon: LayoutDashboard },
  { path: '/gov/pandemic', label: 'Health & Diseases', icon: Activity },
  { path: '/gov/weather', label: 'Weather & Climate', icon: Cloud },
  { path: '/gov/supply-chain', label: 'Supply Chain', icon: Package },
  { path: '/gov/infrastructure', label: 'Infrastructure', icon: Zap },
  { path: '/gov/cybersecurity', label: 'Cybersecurity', icon: Shield },
  { path: '/gov/public-sentiment', label: 'Public Sentiment', icon: MessageSquare },
  { path: '/gov/form-handling', label: 'Form Handling', icon: Ticket },
  { path: '/gov/volunteers', label: 'Volunteers & Resources', icon: Users },
  { path: '/gov/ai-recommendations', label: 'Data Projections', icon: Brain },
  { path: '/gov/historical', label: 'Historical Analysis', icon: History },
  { path: '/gov/broadcast', label: 'Broadcast Centre', icon: Radio },
];

export default function GovLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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

  const profileName = profileUser?.displayName ?? profileUser?.username ?? profileUser?.email ?? 'Authorized User';
  const profileSubtext = profileUser?.agencyCode ?? profileUser?.role ?? 'Government account';

  const logout = () => {
    clearAuthTokens();
    setProfileOpen(false);
    navigate('/login?portal=gov&redirect=%2Fgov');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <Link to="/" className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h1 className="font-bold text-lg">SiGnal</h1>
              <p className="text-xs text-zinc-500">Crisis Command</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700"
                  aria-label="Open profile menu"
                >
                  <UserCircle className="h-5 w-5" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
                    <div className="mb-3 flex items-center gap-3 border-b border-zinc-800 pb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                        <UserCircle className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">{profileName}</div>
                        <div className="truncate text-xs text-zinc-500">{profileSubtext}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 transition-colors hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
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

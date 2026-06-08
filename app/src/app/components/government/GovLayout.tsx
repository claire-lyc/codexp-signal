import { Outlet, Link, useLocation } from 'react-router';
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
} from 'lucide-react';

const navItems = [
  { path: '/gov', label: 'Overview', icon: LayoutDashboard },
  { path: '/gov/pandemic', label: 'Health / Diseases', icon: Activity },
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
  const currentTime = new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

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

        <div className="p-4 border-t border-zinc-800">
          <Link
            to="/gov-profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-800"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-xs">
              <div className="mb-0.5 text-zinc-600">Authorized User</div>
              <div className="truncate text-zinc-400">Profile / Sign out</div>
            </div>
          </Link>
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
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5 text-zinc-400" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></div>
              </button>
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

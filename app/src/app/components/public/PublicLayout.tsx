import { Outlet, Link, useLocation } from 'react-router';
import { Home, Bell, AlertTriangle, Users, MessageSquare, Ticket, Shield, Menu, X, UserCircle, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import EmergencySnapshot from '../shared/EmergencySnapshot';

const navItems = [
  { path: '/public', label: 'Home', icon: Home },
  { path: '/public/alerts', label: 'Alerts', icon: Bell },
  { path: '/public/report', label: 'Report', icon: AlertTriangle },
  { path: '/public/tickets', label: 'Tickets', icon: Ticket },
  { path: '/public/volunteer', label: 'Volunteer', icon: Users },
  { path: '/public/forum', label: 'Forum', icon: MessageSquare },
];

export default function PublicLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-600" />
              <div>
                <h1 className="font-bold text-lg"><span className="text-red-600">S</span>i<span className="text-red-600">G</span>nal</h1>
                <p className="text-xs text-zinc-500">Public Portal</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-red-600 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                    <NotificationLink to="/public/alerts#broadcasts" icon={Megaphone} title="Government broadcast" text="Flash flood warning still active" onClick={() => setNotificationsOpen(false)} />
                    <NotificationLink to="/public/tickets" icon={Ticket} title="Ticket replies" text="View updates from the handling team" onClick={() => setNotificationsOpen(false)} />
                  </div>
                )}
              </div>
              <Link to="/public/profile" className="hidden rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white md:inline-flex">
                <UserCircle className="h-5 w-5" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-900">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-red-600 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <EmergencySnapshot portal="public" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-zinc-900 border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/public/profile" className="mx-auto mb-6 flex max-w-xs items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-blue-800 hover:text-white">
            <UserCircle className="h-5 w-5 text-blue-400" />
            Profile and notifications
          </Link>
          <div className="text-center text-sm text-zinc-500">
            <p className="mb-2">Singapore's National Adaptive Logistics & Alert Network</p>
            <p>A trusted platform for crisis information and coordination</p>
          </div>
        </div>
      </footer>
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

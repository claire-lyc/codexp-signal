import { Outlet, Link, useLocation } from 'react-router';
import {
  Home,
  Bell,
  AlertTriangle,
  Users,
  MessageSquare,
  Shield,
  Menu,
  X,
  UserCircle,
  Megaphone,
  Reply,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/api';
import PublicCrisisAssistant from './PublicCrisisAssistant';
import CitizenOnboarding from './CitizenOnboarding';

const navItems = [
  { path: '/public', label: 'Home', icon: Home },
  { path: '/public/alerts', label: 'Alerts', icon: Bell },
  { path: '/public/report', label: 'Report', icon: AlertTriangle },
  { path: '/public/volunteer', label: 'Volunteer', icon: Users },
  { path: '/public/forum', label: 'Forum', icon: MessageSquare },
];

export default function PublicLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    loadCitizenNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-signal-brand" />
              <div>
                <h1 className="font-bold text-lg">
                  <span className="text-signal-brand">S</span>i
                  <span className="text-signal-brand">G</span>nal
                </h1>
                <p className="text-xs text-zinc-500">Public Portal</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isReportSection = item.path === '/public/report' && (
                  location.pathname === '/public/report' ||
                  location.pathname === '/public/tickets' ||
                  location.pathname === '/public/sos'
                );
                const isActive = isReportSection || location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-zinc-800 text-white ring-1 ring-zinc-700'
                        : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-white'
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
                <button
                  type="button"
                  data-tour="notification-bell"
                  onClick={() => {
                    setNotificationsOpen((open) => !open);
                    void loadCitizenNotifications()
                      .then(setNotifications)
                      .catch(() => setNotifications([]));
                  }}
                  className="relative rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                    {notifications.length ? (
                      notifications.map((item) => (
                        <NotificationLink
                          key={item.id}
                          id={item.id}
                          type={item.type}
                          to={item.to}
                          title={item.title}
                          text={item.text}
                          onClick={() => {
                            setNotificationsOpen(false);
                            setNotifications((current) =>
                              current.filter((notification) => notification.id !== item.id),
                            );
                          }}
                        />
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-zinc-500">
                        No notifications right now.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative hidden md:block">
                <button
                  type="button"
                  data-tour="profile-menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="inline-flex rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  aria-label="Open profile menu"
                >
                  <UserCircle className="h-5 w-5" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
                    <Link
                      to="/public/profile"
                      onClick={() => setProfileOpen(false)}
                      className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-800"
                    >
                      <UserCircle className="h-5 w-5 text-blue-400" />
                      <span>
                        <span className="block text-sm font-semibold text-zinc-100">Profile</span>
                        <span className="block text-xs text-zinc-500">
                          Profile and notifications
                        </span>
                      </span>
                    </Link>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Open mobile menu"
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
                const isReportSection = item.path === '/public/report' && (
                  location.pathname === '/public/report' ||
                  location.pathname === '/public/tickets' ||
                  location.pathname === '/public/sos'
                );
                const isActive = isReportSection || location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-zinc-800 text-white ring-1 ring-zinc-700'
                        : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-white'
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <CitizenOnboarding />

      <footer className="bg-zinc-900 border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-zinc-500">
            <p className="mb-2">Singapore&apos;s National Adaptive Logistics & Alert Network</p>
            <p>A trusted platform for crisis information and coordination</p>
          </div>
        </div>
      </footer>

      <PublicCrisisAssistant />
    </div>
  );
}

type NotificationItem = {
  id: string;
  type: 'alert' | 'reply' | 'agency_ping' | 'volunteer';
  title: string;
  text: string;
  to: string;
};

async function loadCitizenNotifications(): Promise<NotificationItem[]> {
  const response = await fetchWithAuth('/api/notifications');
  if (!response.ok) return [];
  const data = (await response.json()) as { items: NotificationItem[] };
  return data.items;
}

async function markNotificationRead(id: string) {
  await fetchWithAuth(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

function NotificationLink({
  id,
  type,
  to,
  title,
  text,
  onClick,
}: {
  id: string;
  type: NotificationItem['type'];
  to: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
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
  if (type === 'volunteer') return Users;
  return Megaphone;
}

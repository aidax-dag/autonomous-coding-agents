import { useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  ScrollText,
  Settings,
  Activity,
  Keyboard,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useNavigationShortcuts } from '../hooks/useShortcuts';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import type { UINotification } from './NotificationBell';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', shortcut: 'Alt+1' },
  { to: '/agents', icon: Users, label: 'Agents', shortcut: 'Alt+2' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows', shortcut: 'Alt+3' },
  { to: '/logs', icon: ScrollText, label: 'Logs', shortcut: 'Alt+4' },
  { to: '/settings', icon: Settings, label: 'Settings', shortcut: 'Alt+5' },
];

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [notifications, setNotifications] = useState<UINotification[]>([]);

  useNavigationShortcuts(navigate);

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleClearAll = useCallback(() => setNotifications([]), []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 dark:border-gray-700">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-sm">ACA Dashboard</span>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {nav.map(({ to, icon: Icon, label, shortcut }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              <kbd className="hidden lg:inline text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">
                {shortcut}
              </kbd>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
          <div className="text-xs text-gray-400">ACA v0.1.0</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-10 flex items-center justify-end px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 gap-2">
          <NotificationBell
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onDismiss={handleDismiss}
            onClearAll={handleClearAll}
          />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3">Keyboard Shortcuts</h3>
            <div className="space-y-1.5">
              {nav.map(({ label, shortcut }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                  <kbd className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

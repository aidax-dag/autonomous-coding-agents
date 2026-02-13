import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  ScrollText,
  Settings,
  Activity,
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 dark:border-gray-700">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-sm">ACA Dashboard</span>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
          ACA v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

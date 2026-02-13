import { useState, useRef, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';

export interface UINotification {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface Props {
  notifications: UINotification[];
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const levelColors = {
  info: 'border-l-blue-500',
  success: 'border-l-green-500',
  warning: 'border-l-yellow-500',
  error: 'border-l-red-500',
};

export default function NotificationBell({
  notifications,
  onMarkRead,
  onDismiss,
  onClearAll,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell className="w-4 h-4 text-gray-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2 border-l-2 ${levelColors[n.level]} ${
                    n.read ? 'opacity-60' : ''
                  } hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-2`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.read && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        className="p-0.5 text-gray-400 hover:text-green-500"
                        title="Mark read"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onDismiss(n.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

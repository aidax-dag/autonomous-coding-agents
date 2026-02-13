import { Sun, Moon, Monitor } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export default function ThemeToggle({ theme, setTheme }: Props) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`p-1.5 rounded transition-colors ${
            theme === value
              ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

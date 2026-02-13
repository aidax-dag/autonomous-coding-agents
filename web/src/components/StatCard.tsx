import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
}

export default function StatCard({ title, value, sub, icon }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

interface Props {
  status: string;
}

const colors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  idle: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  busy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  degraded: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function StatusBadge({ status }: Props) {
  const cls = colors[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

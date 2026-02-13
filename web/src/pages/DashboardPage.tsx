import { useQuery } from '@tanstack/react-query';
import { Activity, Users, CheckCircle, XCircle, Wifi } from 'lucide-react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 5000,
  });

  const { data: snapshot } = useQuery({
    queryKey: ['snapshot'],
    queryFn: api.getSnapshot,
    refetchInterval: 5000,
  });

  const { data: sseClients } = useQuery({
    queryKey: ['sse-clients'],
    queryFn: api.getSSEClients,
    refetchInterval: 10000,
  });

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        {health && <StatusBadge status={health.status} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="System Health"
          value={`${snapshot?.systemHealth ?? health?.health ?? 0}%`}
          icon={<Activity className="w-4 h-4" />}
        />
        <StatCard
          title="Active Agents"
          value={snapshot?.agents.length ?? 0}
          sub={`${snapshot?.agents.filter((a) => a.status === 'busy').length ?? 0} busy`}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          title="Tasks Completed"
          value={snapshot?.totalTasksCompleted ?? 0}
          sub={`${snapshot?.totalTasksFailed ?? 0} failed`}
          icon={<CheckCircle className="w-4 h-4" />}
        />
        <StatCard
          title="SSE Clients"
          value={sseClients?.clients ?? 0}
          sub={snapshot ? `Uptime: ${formatUptime(snapshot.uptime)}` : undefined}
          icon={<Wifi className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold">Agent Overview</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {snapshot?.agents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No agents registered
            </div>
          )}
          {snapshot?.agents.map((agent) => (
            <div key={agent.agentId} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    agent.status === 'busy'
                      ? 'bg-yellow-400'
                      : agent.status === 'error'
                        ? 'bg-red-400'
                        : 'bg-green-400'
                  }`}
                />
                <div>
                  <span className="text-sm font-medium">{agent.agentId}</span>
                  <span className="ml-2 text-xs text-gray-500">{agent.teamType}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {agent.tasksCompleted}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-500" />
                  {agent.tasksFailed}
                </span>
                <StatusBadge status={agent.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

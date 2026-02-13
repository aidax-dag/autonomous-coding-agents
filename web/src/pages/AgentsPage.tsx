import { useQuery } from '@tanstack/react-query';
import { Users, Clock, CheckCircle, XCircle, Cpu } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function AgentsPage() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
    refetchInterval: 5000,
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
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" /> Agents
        </h1>
        <span className="text-sm text-gray-500">{agents?.length ?? 0} registered</span>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">Loading agents...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents?.map((agent) => (
          <div
            key={agent.agentId}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm">{agent.agentId}</span>
              </div>
              <StatusBadge status={agent.status} />
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Team</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {agent.teamType}
                </span>
              </div>
              {agent.currentTask && (
                <div className="flex justify-between">
                  <span>Current Task</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-32">
                    {agent.currentTask}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3 text-green-500" />
                {agent.tasksCompleted} done
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <XCircle className="w-3 h-3 text-red-500" />
                {agent.tasksFailed} failed
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                <Clock className="w-3 h-3" />
                {formatUptime(agent.uptime)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && agents?.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500">No agents registered yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Start the orchestrator to register agents
          </p>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Plus, Send, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: snapshot } = useQuery({
    queryKey: ['snapshot'],
    queryFn: api.getSnapshot,
    refetchInterval: 5000,
  });

  const submitMutation = useMutation({
    mutationFn: api.submitTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshot'] });
      setName('');
      setDescription('');
      setShowForm(false);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitBranch className="w-5 h-5" /> Workflows
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Submit Task
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Task</h3>
          <input
            type="text"
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => submitMutation.mutate({ name, description })}
              disabled={!name.trim() || submitMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit
            </button>
          </div>
          {submitMutation.isError && (
            <p className="text-xs text-red-500">
              {(submitMutation.error as Error).message}
            </p>
          )}
          {submitMutation.isSuccess && (
            <p className="text-xs text-green-600">
              Task submitted: {submitMutation.data.taskId}
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Active Workflows</h2>
          <span className="text-xs text-gray-500">
            {snapshot?.activeWorkflows ?? 0} active
          </span>
        </div>
        <div className="p-4">
          {(snapshot?.activeWorkflows ?? 0) > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <StatusBadge status="busy" />
                <span>{snapshot!.activeWorkflows} workflow(s) running</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <GitBranch className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No active workflows</p>
              <p className="text-xs text-gray-400 mt-1">
                Submit a task to start a workflow
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

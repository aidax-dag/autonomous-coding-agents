/**
 * Task Webview Types
 *
 * Shared type definitions for the task webview panels
 * and message protocol between webview and extension host.
 *
 * @module platform/vscode
 */

export interface TaskInfo {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: string;
  error?: string;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  agentId?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
}

export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

export type TaskFilter = 'all' | 'active' | 'completed' | 'failed';

/**
 * Command Handlers
 *
 * Implements all ACA VS Code command handlers that bridge
 * user interactions to ACA API client calls.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import type { ACAClient } from './aca-client';
import type { AgentsTreeProvider } from './views/agents-tree-provider';
import { TaskWebviewPanel } from './views/task-webview-panel';
import { TaskDetailPanel } from './views/task-detail-panel';

export interface CommandDependencies {
  client: ACAClient;
  outputChannel: vscode.OutputChannel;
  agentsProvider: AgentsTreeProvider;
  extensionUri: vscode.Uri;
}

let taskWebviewPanel: TaskWebviewPanel | undefined;

/**
 * Reset module-level state. Intended for unit tests only.
 */
export function _resetForTesting(): void {
  if (taskWebviewPanel) {
    taskWebviewPanel.dispose();
    taskWebviewPanel = undefined;
  }
}

/**
 * Submit a new task via the ACA API.
 * Shows an input box for the user to describe the task goal.
 */
export async function submitTask(deps: CommandDependencies): Promise<void> {
  const goal = await vscode.window.showInputBox({
    prompt: 'Describe the task for ACA',
    placeHolder: 'e.g. Implement user authentication with JWT',
  });

  if (!goal) return;

  try {
    const result = await deps.client.submitTask(goal);
    deps.outputChannel.appendLine(`[ACA] Task submitted: ${result.taskId} — ${result.status}`);
    const showNotifications = vscode.workspace
      .getConfiguration('aca')
      .get<boolean>('showNotifications', true);
    if (showNotifications) {
      vscode.window.showInformationMessage(
        `ACA task submitted: ${result.taskId}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.outputChannel.appendLine(`[ACA] Submit failed: ${message}`);
    vscode.window.showErrorMessage(`ACA: Failed to submit task — ${message}`);
  }
}

/**
 * Show the ACA task webview panel for task submission and monitoring.
 */
export function showStatus(deps: CommandDependencies): void {
  if (!taskWebviewPanel) {
    taskWebviewPanel = new TaskWebviewPanel(deps.extensionUri, deps.client);
  }
  taskWebviewPanel.show();
  deps.outputChannel.appendLine('[ACA] Task panel opened');
}

/**
 * Show detailed view for a specific task.
 */
export async function showTaskDetail(deps: CommandDependencies, taskId: string): Promise<void> {
  if (!taskId) return;
  const panel = new TaskDetailPanel(deps.extensionUri, deps.client, taskId);
  await panel.show();
  deps.outputChannel.appendLine(`[ACA] Task detail opened: ${taskId}`);
}

/**
 * Refresh the agents tree view with current data from the server.
 */
export async function showAgents(deps: CommandDependencies): Promise<void> {
  try {
    const result = await deps.client.getAgents();
    deps.agentsProvider.updateAgents(result.agents ?? []);
    deps.outputChannel.appendLine(
      `[ACA] Agents refreshed: ${result.agents?.length ?? 0} agents`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.outputChannel.appendLine(`[ACA] Agent refresh failed: ${message}`);
    vscode.window.showErrorMessage(`ACA: Failed to get agents — ${message}`);
  }
}

/**
 * Stop the currently running task.
 */
export async function stopTask(deps: CommandDependencies): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Stop the current ACA task?',
    { modal: true },
    'Stop',
  );

  if (confirm !== 'Stop') return;

  try {
    deps.outputChannel.appendLine('[ACA] Stop task requested');
    vscode.window.showInformationMessage('ACA: Task stop requested');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.outputChannel.appendLine(`[ACA] Stop task failed: ${message}`);
    vscode.window.showErrorMessage(`ACA: Failed to stop task — ${message}`);
  }
}

/**
 * Show the ACA output channel with log messages.
 */
export function showLogs(deps: CommandDependencies): void {
  deps.outputChannel.show(true);
}

/**
 * Open VS Code settings filtered to ACA configuration.
 */
export function configure(): void {
  vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:aca.aca-vscode',
  );
}

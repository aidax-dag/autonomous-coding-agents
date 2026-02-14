/**
 * VS Code Extension Entry Point
 *
 * Activates the ACA extension by wiring up the ACA client,
 * command handlers, status bar, sidebar tree views, and
 * optional auto-connect behaviour.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import { ACAClient } from './aca-client';
import { ACAStatusBar } from './status-bar';
import { TasksTreeProvider } from './views/tasks-tree-provider';
import { AgentsTreeProvider } from './views/agents-tree-provider';
import {
  submitTask,
  showStatus,
  showTaskDetail,
  showAgents,
  stopTask,
  showLogs,
  configure,
} from './commands';
import type { CommandDependencies } from './commands';

let client: ACAClient | null = null;
let statusBar: ACAStatusBar | null = null;

/**
 * Called by VS Code when the extension is activated.
 * Registers commands, creates the status bar and tree views,
 * and optionally auto-connects to the ACA server.
 */
export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('aca');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
  const autoConnect = config.get<boolean>('autoConnect', true);

  // Create core instances
  client = new ACAClient(serverUrl);
  const outputChannel = vscode.window.createOutputChannel('ACA');
  statusBar = new ACAStatusBar(client);
  const tasksProvider = new TasksTreeProvider();
  const agentsProvider = new AgentsTreeProvider();

  const deps: CommandDependencies = { client, outputChannel, agentsProvider, extensionUri: context.extensionUri };

  // Register tree views
  const tasksView = vscode.window.createTreeView('aca.tasksView', {
    treeDataProvider: tasksProvider,
  });
  const agentsView = vscode.window.createTreeView('aca.agentsView', {
    treeDataProvider: agentsProvider,
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aca.submitTask', () => submitTask(deps)),
    vscode.commands.registerCommand('aca.showStatus', () => showStatus(deps)),
    vscode.commands.registerCommand('aca.showTaskDetail', (taskId: string) => showTaskDetail(deps, taskId)),
    vscode.commands.registerCommand('aca.showAgents', () => showAgents(deps)),
    vscode.commands.registerCommand('aca.stopTask', () => stopTask(deps)),
    vscode.commands.registerCommand('aca.showLogs', () => showLogs(deps)),
    vscode.commands.registerCommand('aca.configure', () => configure()),
  );

  // Register disposables
  context.subscriptions.push(
    outputChannel,
    statusBar,
    tasksView,
    agentsView,
    tasksProvider,
    agentsProvider,
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aca.serverUrl')) {
        const newUrl = vscode.workspace
          .getConfiguration('aca')
          .get<string>('serverUrl', 'http://localhost:3000');
        client?.setServerUrl(newUrl);
        outputChannel.appendLine(`[ACA] Server URL changed to ${newUrl}`);
      }
    }),
  );

  outputChannel.appendLine('[ACA] Extension activated');

  // Auto-connect if configured
  if (autoConnect) {
    client.connect().then(
      () => outputChannel.appendLine('[ACA] Auto-connected to server'),
      (err) => {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[ACA] Auto-connect failed: ${message}`);
      },
    );
  }
}

/**
 * Called by VS Code when the extension is deactivated.
 * Cleans up the client connection and status bar.
 */
export function deactivate(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
  if (statusBar) {
    statusBar.dispose();
    statusBar = null;
  }
}

/**
 * Task Webview Panel
 *
 * Provides a webview-based UI for task submission, monitoring,
 * and result display within VS Code. Communicates with the
 * extension host via a typed message protocol.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import type { ACAClient } from '../aca-client';
import type { TaskInfo, WebviewMessage } from './task-types';

export class TaskWebviewPanel {
  public static readonly viewType = 'aca.taskPanel';

  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private readonly client: ACAClient;
  private readonly disposables: vscode.Disposable[] = [];
  private tasks: TaskInfo[] = [];
  private unsubscribeSSE: (() => void) | undefined;
  private unsubscribeConnection: (() => void) | undefined;

  constructor(extensionUri: vscode.Uri, client: ACAClient) {
    this.extensionUri = extensionUri;
    this.client = client;
  }

  /**
   * Create or reveal the task webview panel.
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      TaskWebviewPanel.viewType,
      'ACA Tasks',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    );

    this.panel.webview.html = this._getWebviewContent();

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this._handleMessage(message),
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(() => this._onDidDispose(), undefined, this.disposables);

    // Subscribe to SSE for real-time updates
    this.unsubscribeSSE = this.client.subscribeSSE((event) => {
      const data = event.data as Record<string, unknown>;
      switch (event.event) {
        case 'task:progress':
          this.panel?.webview.postMessage({
            type: 'taskProgress',
            taskId: data.taskId,
            progress: data.progress,
            message: data.message,
          });
          break;
        case 'task:completed':
          this.panel?.webview.postMessage({
            type: 'taskCompleted',
            taskId: data.taskId,
            result: data.result,
          });
          break;
        case 'task:failed':
          this.panel?.webview.postMessage({
            type: 'taskFailed',
            taskId: data.taskId,
            error: data.error,
          });
          break;
      }
    });

    // Subscribe to connection state changes
    this.unsubscribeConnection = this.client.onConnectionChange((state) => {
      this.panel?.webview.postMessage({
        type: 'connectionStatus',
        connected: state === 'connected',
      });
    });

    // Send initial connection status
    this.panel.webview.postMessage({
      type: 'connectionStatus',
      connected: this.client.isConnected(),
    });
  }

  /**
   * Dispose the panel and all associated resources.
   */
  dispose(): void {
    this.unsubscribeSSE?.();
    this.unsubscribeConnection?.();
    this.panel?.dispose();
    this.panel = undefined;
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }

  /**
   * Send updated task data to the webview.
   */
  private _updateTasks(tasks: TaskInfo[]): void {
    this.tasks = tasks;
    this.panel?.webview.postMessage({
      type: 'tasksUpdate',
      tasks: this.tasks,
    });
  }

  /**
   * Submit a task via the client and update the webview.
   */
  private async _onTaskSubmit(goal: string): Promise<void> {
    try {
      const result = await this.client.submitTask(goal);
      const task: TaskInfo = {
        id: result.taskId,
        goal,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };
      this.tasks = [task, ...this.tasks];
      this.panel?.webview.postMessage({ type: 'taskSubmitted', task });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`ACA: Failed to submit task — ${message}`);
    }
  }

  /**
   * Handle messages from the webview JavaScript.
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'submitTask':
        await this._onTaskSubmit(message.goal as string);
        break;
      case 'cancelTask':
        // Cancel is a best-effort operation logged to output
        break;
      case 'refreshTasks':
        try {
          const snapshot = await this.client.getStatus();
          const agents = snapshot.agents ?? [];
          const tasks: TaskInfo[] = agents
            .filter((a) => a.currentTask)
            .map((a) => ({
              id: a.currentTask as string,
              goal: a.currentTask as string,
              status: 'running' as const,
              submittedAt: new Date().toISOString(),
              agentId: a.agentId,
              progress: a.progress,
            }));
          this._updateTasks(tasks);
        } catch {
          // Silently fail on refresh — user can retry
        }
        break;
      case 'showTaskDetail':
        vscode.commands.executeCommand('aca.showTaskDetail', message.taskId);
        break;
    }
  }

  /**
   * Clean up when the panel is closed by the user.
   */
  private _onDidDispose(): void {
    this.unsubscribeSSE?.();
    this.unsubscribeConnection?.();
    this.panel = undefined;
  }

  /**
   * Generate the full HTML content for the webview.
   * Uses VS Code CSS variables for theme consistency
   * and a nonce-based CSP for security.
   */
  private _getWebviewContent(): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>ACA Tasks</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 1.3em;
      font-weight: 600;
    }
    .connection-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85em;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .connection-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--vscode-charts-red);
    }
    .connection-dot.connected {
      background: var(--vscode-charts-green);
    }
    .submit-form {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .submit-form input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: var(--vscode-font-size);
    }
    .submit-form input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .submit-form input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    .submit-form button, .refresh-btn {
      padding: 6px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    .submit-form button:hover, .refresh-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .section-header h2 {
      font-size: 1.1em;
      font-weight: 600;
    }
    .task-list {
      list-style: none;
      margin-bottom: 20px;
    }
    .task-item {
      padding: 10px 12px;
      margin-bottom: 6px;
      border-radius: 4px;
      background: var(--vscode-list-hoverBackground);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .task-item:hover {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .task-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .task-goal {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .task-status {
      font-size: 0.85em;
      padding: 1px 8px;
      border-radius: 8px;
      margin-left: 8px;
      white-space: nowrap;
    }
    .status-pending { background: var(--vscode-charts-yellow); color: #000; }
    .status-running { background: var(--vscode-charts-blue); color: #fff; }
    .status-completed { background: var(--vscode-charts-green); color: #fff; }
    .status-failed { background: var(--vscode-charts-red); color: #fff; }
    .progress-bar {
      height: 4px;
      border-radius: 2px;
      background: var(--vscode-progressBar-background);
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--vscode-charts-blue);
      transition: width 0.3s ease;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ACA Tasks</h1>
    <span class="connection-badge">
      <span class="connection-dot" id="connectionDot"></span>
      <span id="connectionText">Disconnected</span>
    </span>
  </div>

  <form class="submit-form" id="submitForm">
    <input type="text" id="goalInput"
      placeholder="Describe the task for ACA..."
      aria-label="Task goal" />
    <button type="submit">Submit</button>
  </form>

  <div class="section-header">
    <h2>Active Tasks</h2>
    <button class="refresh-btn" id="refreshBtn" aria-label="Refresh tasks">Refresh</button>
  </div>
  <ul class="task-list" id="activeTasks" role="list" aria-label="Active tasks">
    <li class="empty-state">No active tasks</li>
  </ul>

  <div class="section-header">
    <h2>Task History</h2>
  </div>
  <ul class="task-list" id="taskHistory" role="list" aria-label="Task history">
    <li class="empty-state">No completed tasks</li>
  </ul>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const goalInput = document.getElementById('goalInput');
      const submitForm = document.getElementById('submitForm');
      const refreshBtn = document.getElementById('refreshBtn');
      const activeTasks = document.getElementById('activeTasks');
      const taskHistory = document.getElementById('taskHistory');
      const connectionDot = document.getElementById('connectionDot');
      const connectionText = document.getElementById('connectionText');

      let tasks = [];

      submitForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const goal = goalInput.value.trim();
        if (!goal) return;
        vscode.postMessage({ type: 'submitTask', goal: goal });
        goalInput.value = '';
      });

      refreshBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'refreshTasks' });
      });

      function renderTasks() {
        var active = tasks.filter(function(t) { return t.status === 'pending' || t.status === 'running'; });
        var history = tasks.filter(function(t) { return t.status === 'completed' || t.status === 'failed'; });

        if (active.length === 0) {
          activeTasks.innerHTML = '<li class="empty-state">No active tasks</li>';
        } else {
          activeTasks.innerHTML = active.map(function(t) {
            var progressHtml = typeof t.progress === 'number'
              ? '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + t.progress + '%"></div></div>'
              : '';
            return '<li class="task-item" data-id="' + t.id + '" role="listitem">' +
              '<div class="task-row">' +
              '<span class="task-goal">' + escapeHtml(t.goal) + '</span>' +
              '<span class="task-status status-' + t.status + '">' + t.status + '</span>' +
              '</div>' + progressHtml + '</li>';
          }).join('');
        }

        if (history.length === 0) {
          taskHistory.innerHTML = '<li class="empty-state">No completed tasks</li>';
        } else {
          taskHistory.innerHTML = history.map(function(t) {
            return '<li class="task-item" data-id="' + t.id + '" role="listitem">' +
              '<div class="task-row">' +
              '<span class="task-goal">' + escapeHtml(t.goal) + '</span>' +
              '<span class="task-status status-' + t.status + '">' + t.status + '</span>' +
              '</div></li>';
          }).join('');
        }

        document.querySelectorAll('.task-item').forEach(function(el) {
          el.addEventListener('click', function() {
            vscode.postMessage({ type: 'showTaskDetail', taskId: el.getAttribute('data-id') });
          });
        });
      }

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      }

      window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
          case 'tasksUpdate':
            tasks = msg.tasks || [];
            renderTasks();
            break;
          case 'taskSubmitted':
            tasks.unshift(msg.task);
            renderTasks();
            break;
          case 'taskProgress':
            for (var i = 0; i < tasks.length; i++) {
              if (tasks[i].id === msg.taskId) {
                tasks[i].progress = msg.progress;
                tasks[i].status = 'running';
                break;
              }
            }
            renderTasks();
            break;
          case 'taskCompleted':
            for (var j = 0; j < tasks.length; j++) {
              if (tasks[j].id === msg.taskId) {
                tasks[j].status = 'completed';
                tasks[j].result = msg.result;
                break;
              }
            }
            renderTasks();
            break;
          case 'taskFailed':
            for (var k = 0; k < tasks.length; k++) {
              if (tasks[k].id === msg.taskId) {
                tasks[k].status = 'failed';
                tasks[k].error = msg.error;
                break;
              }
            }
            renderTasks();
            break;
          case 'connectionStatus':
            connectionDot.className = 'connection-dot' + (msg.connected ? ' connected' : '');
            connectionText.textContent = msg.connected ? 'Connected' : 'Disconnected';
            break;
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

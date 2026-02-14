/**
 * Task Detail Panel
 *
 * Shows detailed information for a single task including
 * status timeline, agent assignments, log streaming,
 * and result or error details.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import type { ACAClient } from '../aca-client';
import type { TaskInfo } from './task-types';

export class TaskDetailPanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private readonly client: ACAClient;
  private readonly taskId: string;
  private readonly disposables: vscode.Disposable[] = [];
  private task: TaskInfo | undefined;
  private unsubscribeSSE: (() => void) | undefined;

  constructor(extensionUri: vscode.Uri, client: ACAClient, taskId: string) {
    this.extensionUri = extensionUri;
    this.client = client;
    this.taskId = taskId;
  }

  /**
   * Create the webview panel and load task detail.
   */
  async show(): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      'aca.taskDetail',
      `Task: ${this.taskId}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    );

    this.panel.onDidDispose(() => this._onDidDispose(), undefined, this.disposables);

    // Subscribe to SSE for live updates on this task
    this.unsubscribeSSE = this.client.subscribeSSE((event) => {
      const data = event.data as Record<string, unknown>;
      if (data.taskId !== this.taskId) return;

      switch (event.event) {
        case 'task:progress':
          if (this.task) {
            this.task.progress = data.progress as number;
            this.task.status = 'running';
          }
          this.panel?.webview.postMessage({
            type: 'taskProgress',
            taskId: this.taskId,
            progress: data.progress,
            message: data.message,
          });
          break;
        case 'task:completed':
          if (this.task) {
            this.task.status = 'completed';
            this.task.result = data.result as string;
            this.task.completedAt = new Date().toISOString();
          }
          this.panel?.webview.postMessage({
            type: 'taskCompleted',
            taskId: this.taskId,
            result: data.result,
          });
          break;
        case 'task:failed':
          if (this.task) {
            this.task.status = 'failed';
            this.task.error = data.error as string;
            this.task.completedAt = new Date().toISOString();
          }
          this.panel?.webview.postMessage({
            type: 'taskFailed',
            taskId: this.taskId,
            error: data.error,
          });
          break;
      }
    });

    // Load task data and render
    await this._loadTask();
    this.panel.webview.html = this._getWebviewContent();
  }

  /**
   * Dispose the panel and clean up resources.
   */
  dispose(): void {
    this.unsubscribeSSE?.();
    this.panel?.dispose();
    this.panel = undefined;
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }

  /**
   * Attempt to load task data from the server.
   * Falls back to a minimal placeholder if unavailable.
   */
  private async _loadTask(): Promise<void> {
    try {
      const snapshot = await this.client.getStatus();
      const agent = snapshot.agents?.find((a) => a.currentTask === this.taskId);
      if (agent) {
        this.task = {
          id: this.taskId,
          goal: this.taskId,
          status: 'running',
          submittedAt: new Date().toISOString(),
          agentId: agent.agentId,
          progress: agent.progress,
        };
      }
    } catch {
      // Task data not available — show with limited info
    }
  }

  /**
   * Clean up on panel dispose.
   */
  private _onDidDispose(): void {
    this.unsubscribeSSE?.();
    this.panel = undefined;
  }

  /**
   * Generate detailed HTML content for a single task.
   */
  private _getWebviewContent(): string {
    const nonce = getNonce();
    const task = this.task;
    const goalText = task?.goal ?? this.taskId;
    const statusText = task?.status ?? 'unknown';
    const agentText = task?.agentId ?? 'Unassigned';
    const progressValue = task?.progress ?? 0;
    const submittedAt = task?.submittedAt ?? '-';
    const startedAt = task?.startedAt ?? '-';
    const completedAt = task?.completedAt ?? '-';
    const duration = task?.duration != null ? `${task.duration}s` : '-';
    const tokenUsage = task?.tokenUsage
      ? `Prompt: ${task.tokenUsage.prompt} | Completion: ${task.tokenUsage.completion} | Total: ${task.tokenUsage.total}`
      : '-';
    const resultText = task?.result ?? '';
    const errorText = task?.error ?? '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Task: ${this.taskId}</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }
    h1 { font-size: 1.3em; font-weight: 600; margin-bottom: 12px; }
    .detail-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px 12px;
      margin-bottom: 20px;
    }
    .detail-label {
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
    }
    .detail-value {
      word-break: break-word;
    }
    .status-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 8px;
      font-size: 0.85em;
    }
    .status-pending { background: var(--vscode-charts-yellow); color: #000; }
    .status-running { background: var(--vscode-charts-blue); color: #fff; }
    .status-completed { background: var(--vscode-charts-green); color: #fff; }
    .status-failed { background: var(--vscode-charts-red); color: #fff; }
    .status-unknown { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .progress-bar {
      height: 6px;
      border-radius: 3px;
      background: var(--vscode-progressBar-background);
      overflow: hidden;
      margin-top: 4px;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--vscode-charts-blue);
      transition: width 0.3s ease;
    }
    .timeline {
      margin-bottom: 20px;
      padding: 12px;
      border-radius: 4px;
      background: var(--vscode-list-hoverBackground);
    }
    .timeline h2 { font-size: 1.1em; margin-bottom: 8px; }
    .timeline-step {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }
    .timeline-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    .timeline-dot.active { background: var(--vscode-charts-blue); }
    .timeline-dot.done { background: var(--vscode-charts-green); }
    .timeline-dot.error { background: var(--vscode-charts-red); }
    .section { margin-bottom: 16px; }
    .section h2 { font-size: 1.1em; margin-bottom: 8px; }
    .output-block {
      padding: 10px 12px;
      border-radius: 4px;
      background: var(--vscode-textCodeBlock-background);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
    }
    .error-block {
      border-left: 3px solid var(--vscode-charts-red);
    }
    .result-block {
      border-left: 3px solid var(--vscode-charts-green);
    }
    #logStream {
      min-height: 60px;
    }
  </style>
</head>
<body>
  <h1>Task Detail</h1>

  <div class="detail-grid">
    <span class="detail-label">Task ID</span>
    <span class="detail-value">${this.taskId}</span>

    <span class="detail-label">Goal</span>
    <span class="detail-value">${escapeHtml(goalText)}</span>

    <span class="detail-label">Status</span>
    <span class="detail-value">
      <span class="status-badge status-${statusText}" id="statusBadge">${statusText}</span>
    </span>

    <span class="detail-label">Agent</span>
    <span class="detail-value" id="agentValue">${escapeHtml(agentText)}</span>

    <span class="detail-label">Submitted</span>
    <span class="detail-value">${escapeHtml(submittedAt)}</span>

    <span class="detail-label">Started</span>
    <span class="detail-value">${escapeHtml(startedAt)}</span>

    <span class="detail-label">Completed</span>
    <span class="detail-value" id="completedValue">${escapeHtml(completedAt)}</span>

    <span class="detail-label">Duration</span>
    <span class="detail-value" id="durationValue">${escapeHtml(duration)}</span>

    <span class="detail-label">Token Usage</span>
    <span class="detail-value">${escapeHtml(tokenUsage)}</span>
  </div>

  <div class="progress-bar" id="progressContainer">
    <div class="progress-bar-fill" id="progressFill" style="width: ${progressValue}%"></div>
  </div>

  <div class="timeline">
    <h2>Timeline</h2>
    <div class="timeline-step">
      <span class="timeline-dot done"></span>
      <span>Submitted</span>
    </div>
    <div class="timeline-step">
      <span class="timeline-dot ${statusText === 'running' || statusText === 'completed' ? 'done' : statusText === 'failed' ? 'error' : ''}" id="runningDot"></span>
      <span>Running</span>
    </div>
    <div class="timeline-step">
      <span class="timeline-dot ${statusText === 'completed' ? 'done' : statusText === 'failed' ? 'error' : ''}" id="completedDot"></span>
      <span id="completedLabel">${statusText === 'failed' ? 'Failed' : 'Completed'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Logs</h2>
    <div class="output-block" id="logStream" role="log" aria-live="polite">Waiting for output...</div>
  </div>

  ${resultText ? `<div class="section"><h2>Result</h2><div class="output-block result-block">${escapeHtml(resultText)}</div></div>` : ''}
  ${errorText ? `<div class="section"><h2>Error</h2><div class="output-block error-block">${escapeHtml(errorText)}</div></div>` : ''}

  <script nonce="${nonce}">
    (function() {
      var logStream = document.getElementById('logStream');
      var statusBadge = document.getElementById('statusBadge');
      var progressFill = document.getElementById('progressFill');
      var runningDot = document.getElementById('runningDot');
      var completedDot = document.getElementById('completedDot');
      var completedLabel = document.getElementById('completedLabel');

      window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
          case 'taskProgress':
            statusBadge.textContent = 'running';
            statusBadge.className = 'status-badge status-running';
            if (typeof msg.progress === 'number') {
              progressFill.style.width = msg.progress + '%';
            }
            runningDot.className = 'timeline-dot active';
            if (msg.message) {
              logStream.textContent += '\\n' + msg.message;
              logStream.scrollTop = logStream.scrollHeight;
            }
            break;
          case 'taskCompleted':
            statusBadge.textContent = 'completed';
            statusBadge.className = 'status-badge status-completed';
            progressFill.style.width = '100%';
            runningDot.className = 'timeline-dot done';
            completedDot.className = 'timeline-dot done';
            completedLabel.textContent = 'Completed';
            if (msg.result) {
              logStream.textContent += '\\n[Result] ' + msg.result;
              logStream.scrollTop = logStream.scrollHeight;
            }
            break;
          case 'taskFailed':
            statusBadge.textContent = 'failed';
            statusBadge.className = 'status-badge status-failed';
            runningDot.className = 'timeline-dot error';
            completedDot.className = 'timeline-dot error';
            completedLabel.textContent = 'Failed';
            if (msg.error) {
              logStream.textContent += '\\n[Error] ' + msg.error;
              logStream.scrollTop = logStream.scrollHeight;
            }
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

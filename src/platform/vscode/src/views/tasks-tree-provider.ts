/**
 * Tasks Tree Provider
 *
 * VS Code TreeDataProvider that displays submitted tasks
 * with status icons and duration in the ACA sidebar.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';

// ── Types ────────────────────────────────────────────────────────

export interface TaskInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
}

// ── Tree Item ────────────────────────────────────────────────────

export class TaskTreeItem extends vscode.TreeItem {
  constructor(public readonly task: TaskInfo) {
    super(task.name, vscode.TreeItemCollapsibleState.None);
    this.id = task.id;
    this.description = this.formatDuration(task);
    this.iconPath = this.getStatusIcon(task.status);
    this.tooltip = `${task.name} — ${task.status}`;
    this.contextValue = `task-${task.status}`;
  }

  private getStatusIcon(
    status: TaskInfo['status'],
  ): vscode.ThemeIcon {
    switch (status) {
      case 'pending':
        return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
      case 'running':
        return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
      case 'completed':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      case 'failed':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    }
  }

  private formatDuration(task: TaskInfo): string {
    if (!task.startedAt) return 'queued';
    const start = new Date(task.startedAt).getTime();
    const end = task.completedAt
      ? new Date(task.completedAt).getTime()
      : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }
}

// ── Provider ─────────────────────────────────────────────────────

export class TasksTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private tasks: TaskInfo[] = [];
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TaskTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TaskTreeItem[] {
    return this.tasks.map((task) => new TaskTreeItem(task));
  }

  /**
   * Replace the full task list and refresh the tree.
   */
  updateTasks(tasks: TaskInfo[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Trigger a refresh of the tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

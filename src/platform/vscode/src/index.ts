/**
 * VS Code Extension Module
 *
 * Barrel export for the ACA VS Code extension.
 *
 * @module platform/vscode
 */

export { activate, deactivate } from './extension';
export { ACAClient } from './aca-client';
export type { TaskSubmitOptions, TaskSubmitResult, AgentInfo, SnapshotData, SSEEvent, ConnectionState } from './aca-client';
export { ACAStatusBar } from './status-bar';
export { TasksTreeProvider, TaskTreeItem } from './views/tasks-tree-provider';
export type { TaskInfo } from './views/tasks-tree-provider';
export { AgentsTreeProvider, AgentTreeItem } from './views/agents-tree-provider';

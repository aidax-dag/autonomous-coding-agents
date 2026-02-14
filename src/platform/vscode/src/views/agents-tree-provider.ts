/**
 * Agents Tree Provider
 *
 * VS Code TreeDataProvider that displays registered agents
 * with their roles and current status in the ACA sidebar.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import type { AgentInfo } from '../aca-client';

// ── Tree Item ────────────────────────────────────────────────────

export class AgentTreeItem extends vscode.TreeItem {
  constructor(public readonly agent: AgentInfo) {
    super(agent.agentId, vscode.TreeItemCollapsibleState.None);
    this.id = agent.agentId;
    this.description = agent.agentType;
    this.iconPath = this.getStateIcon(agent.state);
    this.tooltip = `${agent.agentId} (${agent.agentType}) — ${agent.state}`;
    this.contextValue = `agent-${agent.state}`;
  }

  private getStateIcon(state: string): vscode.ThemeIcon {
    switch (state) {
      case 'idle':
      case 'completed':
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.green'));
      case 'working':
      case 'busy':
        return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
      case 'error':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}

// ── Provider ─────────────────────────────────────────────────────

export class AgentsTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  private agents: AgentInfo[] = [];
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): AgentTreeItem[] {
    return this.agents.map((agent) => new AgentTreeItem(agent));
  }

  /**
   * Replace the full agent list and refresh the tree.
   */
  updateAgents(agents: AgentInfo[]): void {
    this.agents = agents;
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

/**
 * ACA Status Bar
 *
 * VS Code status bar item that displays the current connection
 * state and active task count for the ACA server.
 *
 * @module platform/vscode
 */

import * as vscode from 'vscode';
import type { ACAClient, ConnectionState } from './aca-client';

export class ACAStatusBar {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly unsubscribe: () => void;
  private taskCount = 0;

  constructor(client: ACAClient) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.statusBarItem.command = 'aca.submitTask';
    this.updateDisplay(client.getConnectionState());

    this.unsubscribe = client.onConnectionChange((state) => {
      this.updateDisplay(state);
    });

    this.statusBarItem.show();
  }

  /**
   * Update the displayed active task count.
   */
  setTaskCount(count: number): void {
    this.taskCount = count;
    this.updateDisplay('connected');
  }

  /**
   * Dispose the status bar item and unsubscribe from events.
   */
  dispose(): void {
    this.unsubscribe();
    this.statusBarItem.dispose();
  }

  private updateDisplay(state: ConnectionState): void {
    switch (state) {
      case 'connected': {
        const suffix = this.taskCount > 0 ? ` (${this.taskCount} tasks)` : '';
        this.statusBarItem.text = `$(plug) ACA: Connected${suffix}`;
        this.statusBarItem.tooltip = 'ACA - Connected to server. Click to submit a task.';
        this.statusBarItem.backgroundColor = undefined;
        break;
      }
      case 'connecting':
        this.statusBarItem.text = '$(sync~spin) ACA: Connecting...';
        this.statusBarItem.tooltip = 'ACA - Connecting to server...';
        this.statusBarItem.backgroundColor = undefined;
        break;
      case 'error':
        this.statusBarItem.text = '$(error) ACA: Error';
        this.statusBarItem.tooltip = 'ACA - Connection error. Click to retry.';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground',
        );
        break;
      case 'disconnected':
      default:
        this.statusBarItem.text = '$(debug-disconnect) ACA: Disconnected';
        this.statusBarItem.tooltip = 'ACA - Not connected. Click to connect.';
        this.statusBarItem.backgroundColor = undefined;
        break;
    }
  }
}

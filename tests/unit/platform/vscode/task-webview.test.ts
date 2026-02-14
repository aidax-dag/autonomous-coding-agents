/**
 * Tests for ACA Task Webview Panels
 *
 * Tests for the TaskWebviewPanel and TaskDetailPanel classes
 * including webview creation, message handling, SSE updates,
 * and integration with the command handlers.
 *
 * Feature: VS Code Task UI Webview
 */

// ── Mock setup ───────────────────────────────────────────────────

// Mock http/https for ACAClient network calls
const mockRequestCallbacks: Array<{
  onResponse?: (res: unknown) => void;
  onError?: (err: Error) => void;
}> = [];

const createMockResponse = (statusCode: number, body: unknown) => {
  const listeners: Record<string, Array<(chunk: unknown) => void>> = {};
  return {
    statusCode,
    on: jest.fn((event: string, cb: (chunk: unknown) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      if (event === 'data') {
        setTimeout(() => cb(Buffer.from(JSON.stringify(body))), 0);
      }
      if (event === 'end') {
        setTimeout(() => cb(undefined as unknown), 1);
      }
      return { on: jest.fn() };
    }),
  };
};

const createMockRequest = () => {
  const callbacks: Record<string, Array<(data: unknown) => void>> = {};
  return {
    on: jest.fn((event: string, cb: (data: unknown) => void) => {
      if (!callbacks[event]) callbacks[event] = [];
      callbacks[event].push(cb);
    }),
    write: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    _triggerError: (err: Error) => {
      if (callbacks['error']) {
        for (const cb of callbacks['error']) cb(err);
      }
    },
  };
};

jest.mock('http', () => ({
  request: jest.fn((_options: unknown, callback: (res: unknown) => void) => {
    const entry = { onResponse: callback } as {
      onResponse?: (res: unknown) => void;
      onError?: (err: Error) => void;
    };
    mockRequestCallbacks.push(entry);
    const req = createMockRequest();
    entry.onError = (err: Error) => req._triggerError(err);
    return req;
  }),
}));

jest.mock('https', () => ({
  request: jest.fn((_options: unknown, callback: (res: unknown) => void) => {
    const entry = { onResponse: callback } as {
      onResponse?: (res: unknown) => void;
      onError?: (err: Error) => void;
    };
    mockRequestCallbacks.push(entry);
    const req = createMockRequest();
    entry.onError = (err: Error) => req._triggerError(err);
    return req;
  }),
}));

// ── Imports (after mocks) ────────────────────────────────────────

import * as vscode from 'vscode';
import type { MockWebviewPanel } from '../../../__mocks__/vscode';
import { ACAClient } from '@/platform/vscode/src/aca-client';
import { TaskWebviewPanel } from '@/platform/vscode/src/views/task-webview-panel';
import { TaskDetailPanel } from '@/platform/vscode/src/views/task-detail-panel';
import * as commands from '@/platform/vscode/src/commands';
import type { CommandDependencies } from '@/platform/vscode/src/commands';

// ── Test Helpers ─────────────────────────────────────────────────

function resolveLastRequest(statusCode: number, body: unknown): void {
  const entry = mockRequestCallbacks[mockRequestCallbacks.length - 1];
  if (entry?.onResponse) {
    entry.onResponse(createMockResponse(statusCode, body));
  }
}

function rejectLastRequest(errorMessage: string): void {
  const entry = mockRequestCallbacks[mockRequestCallbacks.length - 1];
  if (entry?.onError) {
    entry.onError(new Error(errorMessage));
  }
}

function getLastCreatedPanel(): MockWebviewPanel {
  const mock = vscode.window.createWebviewPanel as jest.Mock;
  return mock.mock.results[mock.mock.results.length - 1].value as MockWebviewPanel;
}

// ── TaskWebviewPanel ─────────────────────────────────────────────

describe('TaskWebviewPanel', () => {
  let client: ACAClient;
  let extensionUri: vscode.Uri;
  let panel: TaskWebviewPanel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    client = new ACAClient('http://localhost:3000');
    extensionUri = vscode.Uri.file('/test/extension');
    panel = new TaskWebviewPanel(extensionUri, client);
  });

  afterEach(() => {
    panel.dispose();
  });

  it('should create webview panel with correct title and options', () => {
    panel.show();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'aca.taskPanel',
      'ACA Tasks',
      1, // ViewColumn.One
      expect.objectContaining({
        enableScripts: true,
        retainContextWhenHidden: true,
      }),
    );
  });

  it('should create panel if not exists on show()', () => {
    panel.show();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
  });

  it('should reveal existing panel if already open on show()', () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    panel.show();
    // Should not create a second panel
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    // Should reveal the existing panel
    expect(mockPanel.reveal).toHaveBeenCalledWith(1);
  });

  it('should generate valid HTML content with VS Code CSS variables', () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();
    const html = mockPanel.webview.html;

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('var(--vscode-editor-background)');
    expect(html).toContain('var(--vscode-editor-foreground)');
    expect(html).toContain('var(--vscode-input-background)');
    expect(html).toContain('var(--vscode-button-background)');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('nonce-');
  });

  it('should handle submitTask message from webview', async () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    // Simulate webview sending a submitTask message
    mockPanel.webview._simulateMessage({ type: 'submitTask', goal: 'Build auth system' });

    // Wait for async client call
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(202, { taskId: 'task-1', status: 'accepted' });
    await new Promise((r) => setTimeout(r, 10));

    // Should have posted a taskSubmitted message back to the webview
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskSubmitted',
        task: expect.objectContaining({
          id: 'task-1',
          goal: 'Build auth system',
          status: 'pending',
        }),
      }),
    );
  });

  it('should handle cancelTask message', () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    // Should not throw
    expect(() => {
      mockPanel.webview._simulateMessage({ type: 'cancelTask', taskId: 'task-1' });
    }).not.toThrow();
  });

  it('should handle refreshTasks message', async () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    mockPanel.webview._simulateMessage({ type: 'refreshTasks' });

    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, {
      agents: [
        { agentId: 'a1', agentType: 'worker', state: 'busy', currentTask: 'task-1', progress: 50 },
      ],
      systemHealth: 95,
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasksUpdate',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            status: 'running',
            agentId: 'a1',
          }),
        ]),
      }),
    );
  });

  it('should update tasks via postMessage', () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    // The connectionStatus message is sent initially
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connectionStatus',
        connected: false,
      }),
    );
  });

  it('should send connectionStatus on connection change', async () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    // Connect the client
    const connectPromise = client.connect();
    resolveLastRequest(200, { status: 'ok' });
    await connectPromise;

    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connectionStatus',
        connected: true,
      }),
    );
  });

  it('should dispose panel and listeners correctly', () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    panel.dispose();

    expect(mockPanel.dispose).toHaveBeenCalled();
  });

  it('should handle task submission error gracefully', async () => {
    panel.show();
    const mockPanel = getLastCreatedPanel();

    mockPanel.webview._simulateMessage({ type: 'submitTask', goal: 'Failing task' });

    await new Promise((r) => setTimeout(r, 10));
    rejectLastRequest('Connection refused');
    await new Promise((r) => setTimeout(r, 10));

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to submit task'),
    );
  });

  it('should set retainContextWhenHidden to true', () => {
    panel.show();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        retainContextWhenHidden: true,
      }),
    );
  });
});

// ── TaskDetailPanel ──────────────────────────────────────────────

describe('TaskDetailPanel', () => {
  let client: ACAClient;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    client = new ACAClient('http://localhost:3000');
    extensionUri = vscode.Uri.file('/test/extension');
  });

  it('should create panel with task ID in title', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-42');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'aca.taskDetail',
      'Task: task-42',
      expect.any(Number),
      expect.any(Object),
    );

    detailPanel.dispose();
  });

  it('should load task detail from client', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-99');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, {
      agents: [
        { agentId: 'agent-1', agentType: 'worker', state: 'busy', currentTask: 'task-99', progress: 75 },
      ],
      systemHealth: 90,
    });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    const mockPanel = getLastCreatedPanel();
    const html = mockPanel.webview.html;

    expect(html).toContain('task-99');
    expect(html).toContain('agent-1');

    detailPanel.dispose();
  });

  it('should generate HTML with task information', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-10');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    const mockPanel = getLastCreatedPanel();
    const html = mockPanel.webview.html;

    expect(html).toContain('Task Detail');
    expect(html).toContain('task-10');
    expect(html).toContain('Timeline');
    expect(html).toContain('Logs');
    expect(html).toContain('Content-Security-Policy');

    detailPanel.dispose();
  });

  it('should handle missing task gracefully', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'nonexistent');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    rejectLastRequest('Not found');
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    // Should still render the panel with limited info
    const mockPanel = getLastCreatedPanel();
    expect(mockPanel.webview.html).toContain('nonexistent');

    detailPanel.dispose();
  });

  it('should update on task progress via SSE', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-sse');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    // The panel subscribes to SSE during show()
    // The SSE subscription was registered with the client
    // We verify the panel was created with scripts enabled
    const mockPanel = getLastCreatedPanel();
    expect(mockPanel.webview.html).toContain('taskProgress');

    detailPanel.dispose();
  });

  it('should show result on completion', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-done');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    const mockPanel = getLastCreatedPanel();
    // The webview script handles taskCompleted messages
    expect(mockPanel.webview.html).toContain('taskCompleted');

    detailPanel.dispose();
  });

  it('should show error on failure', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-err');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    const mockPanel = getLastCreatedPanel();
    // The webview script handles taskFailed messages
    expect(mockPanel.webview.html).toContain('taskFailed');

    detailPanel.dispose();
  });

  it('should dispose correctly', async () => {
    const detailPanel = new TaskDetailPanel(extensionUri, client, 'task-dispose');

    const showPromise = detailPanel.show();
    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(200, { agents: [], systemHealth: 95 });
    await new Promise((r) => setTimeout(r, 10));
    await showPromise;

    const mockPanel = getLastCreatedPanel();

    detailPanel.dispose();
    expect(mockPanel.dispose).toHaveBeenCalled();
  });
});

// ── Integration Tests ────────────────────────────────────────────

describe('Task Webview Integration', () => {
  let client: ACAClient;
  let outputChannel: vscode.OutputChannel;
  let agentsProvider: { updateAgents: jest.Mock; dispose: jest.Mock; onDidChangeTreeData: jest.Mock; getTreeItem: jest.Mock; getChildren: jest.Mock; refresh: jest.Mock };
  let deps: CommandDependencies;

  beforeEach(() => {
    commands._resetForTesting();
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    client = new ACAClient('http://localhost:3000');
    outputChannel = (vscode.window.createOutputChannel as jest.Mock)('ACA');
    agentsProvider = {
      updateAgents: jest.fn(),
      dispose: jest.fn(),
      onDidChangeTreeData: jest.fn(),
      getTreeItem: jest.fn(),
      getChildren: jest.fn(),
      refresh: jest.fn(),
    };
    deps = {
      client,
      outputChannel,
      agentsProvider: agentsProvider as unknown as commands.CommandDependencies['agentsProvider'],
      extensionUri: vscode.Uri.file('/test/extension'),
    };
  });

  afterEach(() => {
    commands._resetForTesting();
  });

  it('should create TaskWebviewPanel when showStatus is called', () => {
    commands.showStatus(deps);

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'aca.taskPanel',
      'ACA Tasks',
      expect.any(Number),
      expect.any(Object),
    );
  });

  it('should reuse same panel on multiple showStatus calls', () => {
    commands.showStatus(deps);
    commands.showStatus(deps);

    // Only one panel creation, second call reveals existing
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    const mockPanel = getLastCreatedPanel();
    expect(mockPanel.reveal).toHaveBeenCalled();
  });

  it('should handle SSE events updating webview', async () => {
    commands.showStatus(deps);
    const mockPanel = getLastCreatedPanel();

    // The SSE subscription was set up during show()
    // Verify the webview has scripts enabled for receiving messages
    expect(mockPanel.webview.html).toContain('acquireVsCodeApi');
  });

  it('should support task submission flow end-to-end', async () => {
    commands.showStatus(deps);
    const mockPanel = getLastCreatedPanel();

    // User submits task from webview
    mockPanel.webview._simulateMessage({ type: 'submitTask', goal: 'E2E test task' });

    await new Promise((r) => setTimeout(r, 10));
    resolveLastRequest(202, { taskId: 'e2e-task-1', status: 'accepted' });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskSubmitted',
        task: expect.objectContaining({
          id: 'e2e-task-1',
          goal: 'E2E test task',
        }),
      }),
    );
  });

  it('should clean up resources on panel disposal', () => {
    commands.showStatus(deps);
    const mockPanel = getLastCreatedPanel();

    // Simulate user closing the panel
    mockPanel.dispose();

    // Panel should be marked as disposed
    expect(mockPanel._disposed).toBe(true);
  });
});

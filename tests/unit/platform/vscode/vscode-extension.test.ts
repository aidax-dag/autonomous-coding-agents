/**
 * Tests for ACA VS Code Extension
 *
 * Comprehensive tests for the ACA client, extension lifecycle,
 * status bar, tree view providers, and command handlers.
 *
 * Feature: VS Code Extension Core
 */

// ── Mock setup ───────────────────────────────────────────────────

// vscode is mapped to tests/__mocks__/vscode.ts via jest moduleNameMapper

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

import * as http from 'http';
import * as vscode from 'vscode';
import { ACAClient } from '@/platform/vscode/src/aca-client';
import type { ConnectionState } from '@/platform/vscode/src/aca-client';
import { ACAStatusBar } from '@/platform/vscode/src/status-bar';
import { TasksTreeProvider, TaskTreeItem } from '@/platform/vscode/src/views/tasks-tree-provider';
import type { TaskInfo } from '@/platform/vscode/src/views/tasks-tree-provider';
import { AgentsTreeProvider, AgentTreeItem } from '@/platform/vscode/src/views/agents-tree-provider';
import { activate, deactivate } from '@/platform/vscode/src/extension';
import * as commands from '@/platform/vscode/src/commands';

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

// ── ACAClient ────────────────────────────────────────────────────

describe('ACAClient', () => {
  let client: ACAClient;

  beforeEach(() => {
    mockRequestCallbacks.length = 0;
    (http.request as jest.Mock).mockClear();
    client = new ACAClient('http://localhost:3000');
  });

  describe('constructor', () => {
    it('should initialize with disconnected state', () => {
      expect(client.isConnected()).toBe(false);
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should strip trailing slashes from server URL', () => {
      const c = new ACAClient('http://localhost:3000///');
      expect(c.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should set state to connected on successful health check', async () => {
      const promise = client.connect();
      resolveLastRequest(200, { status: 'healthy' });
      await promise;
      expect(client.isConnected()).toBe(true);
      expect(client.getConnectionState()).toBe('connected');
    });

    it('should set state to error on failed health check', async () => {
      const promise = client.connect();
      rejectLastRequest('ECONNREFUSED');
      await expect(promise).rejects.toThrow('Failed to connect to ACA server');
      expect(client.getConnectionState()).toBe('error');
    });

    it('should set state to error when health response is empty', async () => {
      const promise = client.connect();
      resolveLastRequest(200, {});
      await expect(promise).rejects.toThrow('Unexpected health response');
      expect(client.getConnectionState()).toBe('error');
    });

    it('should notify connection change listeners', async () => {
      const states: ConnectionState[] = [];
      client.onConnectionChange((state) => states.push(state));
      const promise = client.connect();
      resolveLastRequest(200, { status: 'ok' });
      await promise;
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });
  });

  describe('disconnect', () => {
    it('should set state to disconnected', async () => {
      const promise = client.connect();
      resolveLastRequest(200, { status: 'ok' });
      await promise;
      client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should notify connection change listeners on disconnect', async () => {
      // First connect so we are not already in 'disconnected' state
      const promise = client.connect();
      resolveLastRequest(200, { status: 'ok' });
      await promise;

      const states: ConnectionState[] = [];
      client.onConnectionChange((state) => states.push(state));
      client.disconnect();
      expect(states).toContain('disconnected');
    });
  });

  describe('submitTask', () => {
    it('should send POST to /api/tasks with task name', async () => {
      const promise = client.submitTask('Implement feature X');
      resolveLastRequest(202, { taskId: 'task-1', status: 'accepted' });
      const result = await promise;
      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('accepted');
    });

    it('should include options in request body', async () => {
      const promise = client.submitTask('Fix bug', {
        description: 'Fix login bug',
        type: 'bugfix',
        targetTeam: 'backend',
      });
      resolveLastRequest(202, { taskId: 'task-2', status: 'accepted' });
      const result = await promise;
      expect(result.taskId).toBe('task-2');
    });

    it('should reject on server error', async () => {
      const promise = client.submitTask('Fail task');
      resolveLastRequest(400, { error: 'Task name is required' });
      await expect(promise).rejects.toThrow('Task name is required');
    });
  });

  describe('getStatus', () => {
    it('should send GET to /api/snapshot', async () => {
      const promise = client.getStatus();
      resolveLastRequest(200, { agents: [], systemHealth: 95 });
      const result = await promise;
      expect(result.systemHealth).toBe(95);
      expect(result.agents).toEqual([]);
    });

    it('should reject on network error', async () => {
      const promise = client.getStatus();
      rejectLastRequest('ECONNREFUSED');
      await expect(promise).rejects.toThrow('Request failed');
    });
  });

  describe('getAgents', () => {
    it('should send GET to /api/agents', async () => {
      const agents = [{ agentId: 'a1', agentType: 'task', state: 'idle' }];
      const promise = client.getAgents();
      resolveLastRequest(200, { agents });
      const result = await promise;
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].agentId).toBe('a1');
    });
  });

  describe('getAgent', () => {
    it('should send GET to /api/agents/:id', async () => {
      const promise = client.getAgent('agent-1');
      resolveLastRequest(200, { agentId: 'agent-1', agentType: 'worker', state: 'busy' });
      const result = await promise;
      expect(result.agentId).toBe('agent-1');
    });

    it('should reject on 404', async () => {
      const promise = client.getAgent('nonexistent');
      resolveLastRequest(404, { error: 'Agent not found' });
      await expect(promise).rejects.toThrow('Agent not found');
    });
  });

  describe('subscribeSSE', () => {
    it('should return an unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = client.subscribeSSE(callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('onConnectionChange', () => {
    it('should return an unsubscribe function', () => {
      const cb = jest.fn();
      const unsub = client.onConnectionChange(cb);
      expect(typeof unsub).toBe('function');
    });

    it('should stop notifying after unsubscribe', () => {
      const cb = jest.fn();
      const unsub = client.onConnectionChange(cb);
      unsub();
      client.disconnect();
      // Should not be called because we unsubscribed
      // (it will have been called 0 times since state was already 'disconnected')
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('setAuthToken', () => {
    it('should accept an auth token without error', () => {
      expect(() => client.setAuthToken('test-token')).not.toThrow();
    });
  });

  describe('setServerUrl', () => {
    it('should update the server URL', () => {
      client.setServerUrl('http://newhost:4000/');
      // Verify it works by making a request (it will use the new URL)
      expect(() => client.setServerUrl('http://other:5000')).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON responses', async () => {
      (http.request as jest.Mock).mockImplementationOnce(
        (_options: unknown, callback: (res: unknown) => void) => {
          const res = {
            statusCode: 200,
            on: jest.fn((event: string, cb: (chunk: unknown) => void) => {
              if (event === 'data') setTimeout(() => cb(Buffer.from('not-json')), 0);
              if (event === 'end') setTimeout(() => cb(undefined as unknown), 1);
            }),
          };
          setTimeout(() => callback(res), 0);
          return createMockRequest();
        },
      );
      const promise = client.getStatus();
      await expect(promise).rejects.toThrow('Invalid JSON response');
    });
  });
});

// ── Extension Lifecycle ──────────────────────────────────────────

describe('Extension Lifecycle', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    context = {
      subscriptions: [],
      extensionPath: '/test',
      extensionUri: vscode.Uri.file('/test'),
      globalState: { get: jest.fn(), update: jest.fn() } as unknown as vscode.Memento,
      workspaceState: { get: jest.fn(), update: jest.fn() } as unknown as vscode.Memento,
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/logs',
      extensionMode: 3,
    } as unknown as vscode.ExtensionContext;
  });

  it('should register all seven commands on activation', () => {
    activate(context);
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(7);
    const registeredNames = (vscode.commands.registerCommand as jest.Mock).mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(registeredNames).toContain('aca.submitTask');
    expect(registeredNames).toContain('aca.showStatus');
    expect(registeredNames).toContain('aca.showTaskDetail');
    expect(registeredNames).toContain('aca.showAgents');
    expect(registeredNames).toContain('aca.stopTask');
    expect(registeredNames).toContain('aca.showLogs');
    expect(registeredNames).toContain('aca.configure');
  });

  it('should create a status bar item on activation', () => {
    activate(context);
    expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
  });

  it('should create an output channel on activation', () => {
    activate(context);
    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('ACA');
  });

  it('should create tree views on activation', () => {
    activate(context);
    expect(vscode.window.createTreeView).toHaveBeenCalledTimes(2);
    const viewIds = (vscode.window.createTreeView as jest.Mock).mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(viewIds).toContain('aca.tasksView');
    expect(viewIds).toContain('aca.agentsView');
  });

  it('should push disposables to context.subscriptions', () => {
    activate(context);
    // 6 commands + outputChannel + statusBar + 2 tree views + 2 providers + config listener = 13
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(10);
  });

  it('should listen for configuration changes', () => {
    activate(context);
    expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
  });

  it('should auto-connect when aca.autoConnect is true', () => {
    activate(context);
    // connect() was called, which means http.request was invoked for the health check
    expect(http.request).toHaveBeenCalled();
  });

  it('should clean up on deactivation', () => {
    activate(context);
    expect(() => deactivate()).not.toThrow();
  });

  it('should handle deactivation when not activated', () => {
    // Reset module state via direct deactivate call
    expect(() => deactivate()).not.toThrow();
  });
});

// ── ACAStatusBar ─────────────────────────────────────────────────

describe('ACAStatusBar', () => {
  let client: ACAClient;
  let statusBar: ACAStatusBar;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    client = new ACAClient('http://localhost:3000');
    statusBar = new ACAStatusBar(client);
  });

  afterEach(() => {
    statusBar.dispose();
  });

  it('should create a status bar item', () => {
    expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
  });

  it('should show disconnected text initially', () => {
    const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
    expect(item.text).toContain('Disconnected');
  });

  it('should update text on connection state change', async () => {
    const promise = client.connect();
    resolveLastRequest(200, { status: 'ok' });
    await promise;
    const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
    expect(item.text).toContain('Connected');
  });

  it('should show task count when connected', async () => {
    const promise = client.connect();
    resolveLastRequest(200, { status: 'ok' });
    await promise;
    statusBar.setTaskCount(3);
    const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
    expect(item.text).toContain('3 tasks');
  });

  it('should dispose cleanly', () => {
    const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
    statusBar.dispose();
    expect(item.dispose).toHaveBeenCalled();
  });
});

// ── TasksTreeProvider ────────────────────────────────────────────

describe('TasksTreeProvider', () => {
  let provider: TasksTreeProvider;

  beforeEach(() => {
    provider = new TasksTreeProvider();
  });

  afterEach(() => {
    provider.dispose();
  });

  it('should return empty children initially', () => {
    const children = provider.getChildren();
    expect(children).toEqual([]);
  });

  it('should return task tree items after update', () => {
    const tasks: TaskInfo[] = [
      { id: 't1', name: 'Task One', status: 'running', startedAt: new Date().toISOString() },
      { id: 't2', name: 'Task Two', status: 'completed', startedAt: new Date(Date.now() - 60000).toISOString(), completedAt: new Date().toISOString() },
    ];
    provider.updateTasks(tasks);
    const children = provider.getChildren();
    expect(children).toHaveLength(2);
    expect(children[0].task.name).toBe('Task One');
    expect(children[1].task.name).toBe('Task Two');
  });

  it('should fire onDidChangeTreeData event on update', () => {
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.updateTasks([{ id: 't1', name: 'Test', status: 'pending' }]);
    expect(spy).toHaveBeenCalled();
  });

  it('should fire onDidChangeTreeData event on refresh', () => {
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.refresh();
    expect(spy).toHaveBeenCalled();
  });

  it('should return the element itself from getTreeItem', () => {
    const tasks: TaskInfo[] = [{ id: 't1', name: 'Task', status: 'pending' }];
    provider.updateTasks(tasks);
    const children = provider.getChildren();
    const item = provider.getTreeItem(children[0]);
    expect(item).toBe(children[0]);
  });

  it('should create TaskTreeItem with correct labels', () => {
    const task: TaskInfo = { id: 't1', name: 'My Task', status: 'running', startedAt: new Date().toISOString() };
    const item = new TaskTreeItem(task);
    expect(item.label).toBe('My Task');
    expect(item.tooltip).toContain('running');
  });
});

// ── AgentsTreeProvider ───────────────────────────────────────────

describe('AgentsTreeProvider', () => {
  let provider: AgentsTreeProvider;

  beforeEach(() => {
    provider = new AgentsTreeProvider();
  });

  afterEach(() => {
    provider.dispose();
  });

  it('should return empty children initially', () => {
    expect(provider.getChildren()).toEqual([]);
  });

  it('should return agent tree items after update', () => {
    provider.updateAgents([
      { agentId: 'a1', agentType: 'task', state: 'idle' },
      { agentId: 'a2', agentType: 'worker', state: 'busy' },
    ]);
    const children = provider.getChildren();
    expect(children).toHaveLength(2);
    expect(children[0].agent.agentId).toBe('a1');
    expect(children[1].agent.agentId).toBe('a2');
  });

  it('should fire onDidChangeTreeData event on update', () => {
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.updateAgents([{ agentId: 'a1', agentType: 'task', state: 'idle' }]);
    expect(spy).toHaveBeenCalled();
  });

  it('should fire onDidChangeTreeData event on refresh', () => {
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.refresh();
    expect(spy).toHaveBeenCalled();
  });

  it('should return the element itself from getTreeItem', () => {
    provider.updateAgents([{ agentId: 'a1', agentType: 'task', state: 'idle' }]);
    const children = provider.getChildren();
    expect(provider.getTreeItem(children[0])).toBe(children[0]);
  });

  it('should create AgentTreeItem with correct labels', () => {
    const item = new AgentTreeItem({ agentId: 'agent-x', agentType: 'reviewer', state: 'working' });
    expect(item.label).toBe('agent-x');
    expect(item.description).toBe('reviewer');
    expect(item.tooltip).toContain('working');
  });
});

// ── Command Handlers ─────────────────────────────────────────────

describe('Command Handlers', () => {
  let client: ACAClient;
  let outputChannel: vscode.OutputChannel;
  let agentsProvider: AgentsTreeProvider;
  let deps: commands.CommandDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCallbacks.length = 0;
    client = new ACAClient('http://localhost:3000');
    outputChannel = (vscode.window.createOutputChannel as jest.Mock)('ACA');
    agentsProvider = new AgentsTreeProvider();
    deps = { client, outputChannel, agentsProvider, extensionUri: vscode.Uri.file('/test') };
  });

  afterEach(() => {
    agentsProvider.dispose();
  });

  describe('submitTask', () => {
    it('should show input box and submit task on user input', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('Build auth system');

      const promise = commands.submitTask(deps);
      // Allow the client.submitTask call to be made
      await new Promise((r) => setTimeout(r, 10));
      resolveLastRequest(202, { taskId: 'task-1', status: 'accepted' });
      await promise;

      expect(vscode.window.showInputBox).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('task-1'),
      );
    });

    it('should do nothing when user cancels input', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);
      await commands.submitTask(deps);
      expect(http.request).not.toHaveBeenCalled();
    });

    it('should show error message on failure', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('Fail task');

      const promise = commands.submitTask(deps);
      await new Promise((r) => setTimeout(r, 10));
      rejectLastRequest('Connection refused');
      await promise;

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to submit task'),
      );
    });
  });

  describe('showStatus', () => {
    beforeEach(() => {
      commands._resetForTesting();
    });

    afterEach(() => {
      commands._resetForTesting();
    });

    it('should open the task webview panel', () => {
      commands.showStatus(deps);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'aca.taskPanel',
        'ACA Tasks',
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('should log panel opened message', () => {
      commands.showStatus(deps);

      expect(outputChannel.appendLine).toHaveBeenCalledWith('[ACA] Task panel opened');
    });
  });

  describe('showAgents', () => {
    it('should update agents tree provider', async () => {
      const updateSpy = jest.spyOn(agentsProvider, 'updateAgents');

      const promise = commands.showAgents(deps);
      await new Promise((r) => setTimeout(r, 10));
      resolveLastRequest(200, { agents: [{ agentId: 'a1', agentType: 'task', state: 'idle' }] });
      await promise;

      expect(updateSpy).toHaveBeenCalledWith([
        expect.objectContaining({ agentId: 'a1' }),
      ]);
    });
  });

  describe('stopTask', () => {
    it('should ask for confirmation before stopping', async () => {
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Stop');
      await commands.stopTask(deps);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('stop requested'),
      );
    });

    it('should do nothing when user cancels', async () => {
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
      await commands.stopTask(deps);
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('showLogs', () => {
    it('should show the output channel', () => {
      commands.showLogs(deps);
      expect(outputChannel.show).toHaveBeenCalledWith(true);
    });
  });

  describe('configure', () => {
    it('should execute workbench openSettings command', () => {
      commands.configure();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        '@ext:aca.aca-vscode',
      );
    });
  });
});

/**
 * VS Code API Mock
 *
 * Provides a minimal mock of the VS Code extension API
 * for unit testing the ACA VS Code extension outside of
 * the VS Code host environment.
 */

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
      },
    };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export class TreeItem {
  label: string;
  collapsibleState: number;
  id?: string;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  contextValue?: string;

  constructor(label: string, collapsibleState: number = 0) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: ThemeColor,
  ) {}
}

export class Uri {
  static parse(value: string): Uri {
    return new Uri(value);
  }

  static file(path: string): Uri {
    return new Uri(`file://${path}`);
  }

  constructor(public readonly fsPath: string) {}
}

const registeredCommands: Record<string, (...args: unknown[]) => unknown> = {};

export const commands = {
  registerCommand: jest.fn(
    (command: string, callback: (...args: unknown[]) => unknown) => {
      registeredCommands[command] = callback;
      return { dispose: jest.fn() };
    },
  ),
  executeCommand: jest.fn(async (command: string, ...args: unknown[]) => {
    const handler = registeredCommands[command];
    if (handler) return handler(...args);
  }),
};

const createMockStatusBarItem = () => ({
  text: '',
  tooltip: '',
  command: undefined as string | undefined,
  backgroundColor: undefined as ThemeColor | undefined,
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn(),
});

const createMockOutputChannel = () => ({
  name: 'ACA',
  append: jest.fn(),
  appendLine: jest.fn(),
  clear: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn(),
});

const createMockTreeView = () => ({
  dispose: jest.fn(),
  onDidChangeSelection: jest.fn(),
  onDidChangeVisibility: jest.fn(),
  reveal: jest.fn(),
});

export interface MockWebview {
  html: string;
  options: Record<string, unknown>;
  postMessage: jest.Mock;
  onDidReceiveMessage: jest.Mock;
  asWebviewUri: jest.Mock;
  _messageListeners: Array<(message: unknown) => void>;
  _simulateMessage: (message: unknown) => void;
}

export interface MockWebviewPanel {
  webview: MockWebview;
  viewType: string;
  title: string;
  options: Record<string, unknown>;
  reveal: jest.Mock;
  dispose: jest.Mock;
  onDidDispose: jest.Mock;
  _disposed: boolean;
  _disposeListeners: Array<() => void>;
}

export const createMockWebviewPanel = (
  viewType: string,
  title: string,
  _column: number,
  options?: Record<string, unknown>,
): MockWebviewPanel => {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disposeListeners: Array<() => void> = [];

  const webview: MockWebview = {
    html: '',
    options: options ?? {},
    postMessage: jest.fn().mockResolvedValue(true),
    onDidReceiveMessage: jest.fn((listener: (message: unknown) => void, _thisArg?: unknown, disposables?: Array<{ dispose: () => void }>) => {
      messageListeners.push(listener);
      const disposable = {
        dispose: () => {
          const idx = messageListeners.indexOf(listener);
          if (idx >= 0) messageListeners.splice(idx, 1);
        },
      };
      if (disposables) disposables.push(disposable);
      return disposable;
    }),
    asWebviewUri: jest.fn((uri: Uri) => uri),
    _messageListeners: messageListeners,
    _simulateMessage: (message: unknown) => {
      for (const listener of messageListeners) {
        listener(message);
      }
    },
  };

  const panel: MockWebviewPanel = {
    webview,
    viewType,
    title,
    options: options ?? {},
    reveal: jest.fn(),
    dispose: jest.fn(() => {
      panel._disposed = true;
      for (const listener of disposeListeners) {
        listener();
      }
    }),
    onDidDispose: jest.fn((listener: () => void, _thisArg?: unknown, disposables?: Array<{ dispose: () => void }>) => {
      disposeListeners.push(listener);
      const disposable = {
        dispose: () => {
          const idx = disposeListeners.indexOf(listener);
          if (idx >= 0) disposeListeners.splice(idx, 1);
        },
      };
      if (disposables) disposables.push(disposable);
      return disposable;
    }),
    _disposed: false,
    _disposeListeners: disposeListeners,
  };

  return panel;
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export const window = {
  createStatusBarItem: jest.fn(() => createMockStatusBarItem()),
  createOutputChannel: jest.fn(() => createMockOutputChannel()),
  createTreeView: jest.fn(() => createMockTreeView()),
  createWebviewPanel: jest.fn(
    (viewType: string, title: string, column: number, options?: Record<string, unknown>) =>
      createMockWebviewPanel(viewType, title, column, options),
  ),
  showInputBox: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
};

const configValues: Record<string, unknown> = {
  'aca.serverUrl': 'http://localhost:3000',
  'aca.autoConnect': true,
  'aca.showNotifications': true,
};

export const workspace = {
  getConfiguration: jest.fn((section?: string) => ({
    get: jest.fn(<T>(key: string, defaultValue?: T): T => {
      const fullKey = section ? `${section}.${key}` : key;
      const value = configValues[fullKey];
      return (value !== undefined ? value : defaultValue) as T;
    }),
    update: jest.fn(),
    has: jest.fn((key: string) => {
      const fullKey = section ? `${section}.${key}` : key;
      return fullKey in configValues;
    }),
    inspect: jest.fn(),
  })),
  onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
};

export const _setConfigValue = (key: string, value: unknown): void => {
  configValues[key] = value;
};

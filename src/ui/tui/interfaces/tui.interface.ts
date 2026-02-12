/**
 * TUI Interface Definitions
 * @module ui/tui
 */

export type TUIComponentType = 'agent-panel' | 'task-tracker' | 'cost-display' | 'log-viewer' | 'diff-viewer';

export interface TUIRenderOutput {
  lines: string[];
  width: number;
  height: number;
}

export interface ITUIComponent {
  readonly type: TUIComponentType;
  render(): TUIRenderOutput;
  update(data: unknown): void;
  destroy(): void;
}

export interface ITUIApp {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  addComponent(component: ITUIComponent): void;
  removeComponent(type: TUIComponentType): void;
  getComponent(type: TUIComponentType): ITUIComponent | undefined;
  render(): TUIRenderOutput;
  getComponents(): ITUIComponent[];
}

export interface TUIAppConfig {
  refreshIntervalMs?: number;
  maxLogLines?: number;
  maxDiffLines?: number;
  showCosts?: boolean;
  showMetrics?: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export interface DiffEntry {
  file: string;
  hunks: DiffHunk[];
  timestamp: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

export interface TaskProgress {
  taskId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface CostSummary {
  totalTokens: number;
  totalCost: number;
  currency: string;
  breakdown: CostBreakdownEntry[];
}

export interface CostBreakdownEntry {
  model: string;
  tokens: number;
  cost: number;
}

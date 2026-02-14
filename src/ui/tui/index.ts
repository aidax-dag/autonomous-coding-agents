export type {
  TUIComponentType,
  TUIRenderOutput,
  ITUIComponent,
  ITUIApp,
  TUIAppConfig,
  LogEntry,
  DiffEntry,
  DiffHunk,
  DiffLine,
  TaskProgress,
  CostSummary,
  CostBreakdownEntry,
} from './interfaces/tui.interface';

export { TUIApp, createTUIApp } from './tui-app';

export {
  AgentPanel, createAgentPanel,
  TaskTracker, createTaskTracker,
  CostDisplay, createCostDisplay,
  LogViewer, createLogViewer,
  DiffViewer, createDiffViewer,
} from './components';

export {
  AgentStatusHook, createAgentStatusHook,
  TaskProgressHook, createTaskProgressHook,
} from './hooks';

// ── Ink-based TUI (React/Ink) ─────────────────────────────
export { renderTUI, type RenderTUIOptions, type TUIInstance } from './ink/render';
export { TUIApp as InkTUIApp, type TUIAppProps } from './ink/TUIApp';
export {
  AgentPanel as InkAgentPanel,
  TaskTracker as InkTaskTracker,
  CostDisplay as InkCostDisplay,
  LogViewer as InkLogViewer,
  DiffViewer as InkDiffViewer,
} from './ink/components';
export {
  useAgentStatus,
  useTaskProgress,
  useCostSummary,
  useLogStream,
} from './ink/hooks';

# F014 -- HUDDashboard

> Real-time agent monitoring dashboard with metrics collection, warning management, and system health scoring.

## 1. Purpose

The HUD (Heads-Up Display) Dashboard module provides real-time visibility into agent system state. It aggregates agent statuses, time-series metrics, and operational warnings into a unified snapshot suitable for rendering in CLI, web, or API frontends. The module is split into two components: a MetricsCollector for in-memory time-series data storage, and a HUDDashboard that combines agent tracking, warnings, and metrics into a health-scored snapshot.

## 2. Interface

**Source**: `src/core/hud/interfaces/hud.interface.ts`

### Data Types

```typescript
interface MetricPoint {
  name: string;
  value: number;
  unit: string;          // e.g., 'ms', 'tokens', '%'
  timestamp: string;     // ISO format
  tags?: Record<string, string>;
}

interface AgentHUDStatus {
  agentId: string;
  agentType: string;
  state: 'idle' | 'working' | 'blocked' | 'error' | 'completed';
  currentTask?: string;
  progress: number;      // 0-100
  tokensUsed: number;
  elapsedMs: number;
  updatedAt: string;
}

interface HUDSnapshot {
  timestamp: string;
  agents: AgentHUDStatus[];
  metrics: MetricPoint[];
  warnings: string[];
  systemHealth: number;  // 0-100
}
```

### Component Interfaces

```typescript
interface IMetricsCollector {
  record(metric: MetricPoint): void;
  recordValue(name: string, value: number, unit?: string): void;
  getLatest(count?: number): MetricPoint[];
  getByName(name: string, count?: number): MetricPoint[];
  clear(): void;
}

interface IHUDDashboard {
  updateAgent(status: AgentHUDStatus): void;
  removeAgent(agentId: string): void;
  addWarning(message: string): void;
  clearWarnings(): void;
  snapshot(): HUDSnapshot;
}
```

## 3. Implementation

### MetricsCollector (`src/core/hud/metrics-collector.ts`)

- **Class**: `MetricsCollector implements IMetricsCollector`
- **Config**: `MetricsCollectorConfig { maxPoints?: number }` (default 1000)
- **Storage**: In-memory array of `MetricPoint`
- **Key behaviors**:
  - `record()` appends a copy of the metric point. When the array exceeds `maxPoints`, the oldest entries are spliced off.
  - `recordValue()` is a convenience that creates a MetricPoint with the current ISO timestamp.
  - `getLatest()` and `getByName()` return copies of the data (not references), ensuring immutability of internal state.
  - `getByName()` filters by exact name match, then returns the last `count` entries.
- **Factory**: `createMetricsCollector(config?)`

### HUDDashboard (`src/core/hud/hud-dashboard.ts`)

- **Class**: `HUDDashboard implements IHUDDashboard`
- **Config**: `HUDDashboardConfig { metrics: IMetricsCollector, maxWarnings?: number }` (default 50)
- **Storage**: `Map<string, AgentHUDStatus>` for agents, `string[]` for warnings
- **Key behaviors**:
  - `updateAgent()` stores a copy of the status, keyed by `agentId`.
  - `addWarning()` appends warnings and trims to `maxWarnings` (keeps most recent).
  - `snapshot()` returns a complete dashboard state including all agents, the latest 20 metrics from the collector, all warnings, and a calculated system health score.
  - **Health calculation**: Starts at 100, deducts 20 per agent in `error` state, 10 per agent in `blocked` state, and 10 if warning count exceeds 10. Clamped to [0, 100].
- **Factory**: `createHUDDashboard(config)`

## 4. Dependencies

- **Depends on**: No external module dependencies. HUDDashboard depends on an `IMetricsCollector` instance (injected via config).
- **Depended on by**: CLI/Web frontends (consume snapshots for display), API Gateway (can expose snapshot endpoint), orchestrator (pushes agent status updates).

## 5. Testing

- **Test file location**: `tests/unit/core/hud/hud.test.ts`
- **Test count**: 18 tests across 2 describe blocks
- **Key test scenarios**:
  - MetricsCollector (8 tests): default creation, record/retrieve, full metric point with tags, get by name, enforce max points, clear, return copies (immutability), factory
  - HUDDashboard (10 tests): empty snapshot, track agent statuses, remove agent, manage warnings, enforce max warnings, health deduction for errors (-20), health deduction for blocked (-10), health deduction for many warnings (-10), include metrics in snapshot, factory

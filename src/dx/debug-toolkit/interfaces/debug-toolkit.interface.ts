/**
 * Debug Toolkit Interfaces
 *
 * Type definitions for the debug toolkit module providing
 * agent tracing, state inspection, memory analysis, and profiling.
 *
 * Feature: F3.21 - Debug Toolkit
 * @module dx/debug-toolkit/interfaces
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Log levels for debug output
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent',
}

/**
 * Trace event types
 */
export enum TraceEventType {
  CALL = 'call',
  RETURN = 'return',
  ERROR = 'error',
  TOOL = 'tool',
  LLM = 'llm',
  STATE_CHANGE = 'state_change',
  MESSAGE = 'message',
}

/**
 * Memory allocation types
 */
export enum AllocationCategory {
  AGENT = 'agent',
  TOOL = 'tool',
  CONTEXT = 'context',
  CACHE = 'cache',
  OTHER = 'other',
}

/**
 * Profile metric types
 */
export enum ProfileMetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
}

// ============================================================================
// Tracing Interfaces
// ============================================================================

/**
 * Options for agent tracing
 */
export interface TraceOptions {
  /** Include tool execution details */
  includeTools?: boolean;
  /** Include LLM call details */
  includeLLMCalls?: boolean;
  /** Include state changes */
  includeStateChanges?: boolean;
  /** Maximum events to capture */
  maxEvents?: number;
  /** Event types to filter */
  eventFilter?: TraceEventType[];
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Include call stack information */
  includeCallStack?: boolean;
}

/**
 * Trace event captured during tracing
 */
export interface TraceEvent {
  /** Event unique identifier */
  id: string;
  /** Event type */
  type: TraceEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data: unknown;
  /** Duration in milliseconds (for return/error events) */
  duration?: number;
  /** Associated call ID (for return/error events) */
  callId?: string;
  /** Call stack if captured */
  callStack?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent trace session
 */
export interface AgentTrace {
  /** Trace session ID */
  traceId: string;
  /** Agent being traced */
  agentId: string;
  /** Trace start time */
  startTime: Date;
  /** Trace end time (if stopped) */
  endTime?: Date;
  /** Active status */
  isActive: boolean;
  /** Captured events */
  events: TraceEvent[];
  /** Trace options */
  options: TraceOptions;
  /** Statistics */
  statistics: TraceStatistics;
}

/**
 * Trace statistics
 */
export interface TraceStatistics {
  /** Total events captured */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<TraceEventType, number>;
  /** Average event duration */
  averageDuration: number;
  /** Total trace duration */
  traceDuration: number;
  /** Error count */
  errorCount: number;
}

/**
 * Trace log for export
 */
export interface TraceLog {
  /** Trace metadata */
  trace: Omit<AgentTrace, 'events'>;
  /** Events in chronological order */
  events: TraceEvent[];
  /** Export timestamp */
  exportedAt: Date;
  /** Log format version */
  version: string;
}

// ============================================================================
// State Inspection Interfaces
// ============================================================================

/**
 * Agent state snapshot
 */
export interface AgentStateSnapshot {
  /** Agent ID */
  agentId: string;
  /** Agent type */
  agentType: string;
  /** Current status */
  status: string;
  /** Snapshot timestamp */
  timestamp: Date;
  /** Configuration (sanitized) */
  config: Record<string, unknown>;
  /** Current task (if any) */
  currentTask?: TaskSnapshot;
  /** Pending tasks count */
  pendingTasksCount: number;
  /** Completed tasks count */
  completedTasksCount: number;
  /** Health status */
  health: HealthSnapshot;
  /** Memory usage */
  memoryUsage: MemorySnapshot;
  /** Custom state data */
  customState?: Record<string, unknown>;
}

/**
 * Task snapshot for inspection
 */
export interface TaskSnapshot {
  /** Task ID */
  id: string;
  /** Task type */
  type: string;
  /** Task status */
  status: string;
  /** Start time */
  startTime: Date;
  /** Elapsed time in ms */
  elapsedTime: number;
  /** Progress percentage */
  progress?: number;
}

/**
 * Health snapshot
 */
export interface HealthSnapshot {
  /** Overall health status */
  healthy: boolean;
  /** Last health check time */
  lastCheck: Date;
  /** Component health details */
  components: Record<string, boolean>;
  /** Warning messages */
  warnings: string[];
}

/**
 * Memory snapshot for agent
 */
export interface MemorySnapshot {
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** Array buffers in bytes */
  arrayBuffers: number;
  /** RSS (resident set size) in bytes */
  rss: number;
}

/**
 * Tool execution detail
 */
export interface ToolExecutionDetail {
  /** Execution ID */
  executionId: string;
  /** Tool name */
  toolName: string;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime?: Date;
  /** Duration in ms */
  duration: number;
  /** Input parameters (sanitized) */
  input: Record<string, unknown>;
  /** Output result (sanitized) */
  output?: unknown;
  /** Error if failed */
  error?: ErrorDetail;
  /** Was cached */
  cached: boolean;
  /** Retry count */
  retryCount: number;
}

/**
 * LLM call detail
 */
export interface LLMCallDetail {
  /** Call ID */
  callId: string;
  /** Provider name */
  provider: string;
  /** Model name */
  model: string;
  /** Call start time */
  startTime: Date;
  /** Call end time */
  endTime?: Date;
  /** Duration in ms */
  duration: number;
  /** Messages sent (truncated) */
  messagesSummary: MessageSummary[];
  /** Response summary */
  responseSummary?: string;
  /** Token usage */
  tokenUsage: TokenUsageDetail;
  /** Was streamed */
  streamed: boolean;
  /** Error if failed */
  error?: ErrorDetail;
}

/**
 * Message summary for LLM calls
 */
export interface MessageSummary {
  /** Message role */
  role: string;
  /** Content length */
  contentLength: number;
  /** Content preview (first N chars) */
  preview: string;
}

/**
 * Token usage detail
 */
export interface TokenUsageDetail {
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Estimated cost (if available) */
  estimatedCost?: number;
}

/**
 * Error detail for debugging
 */
export interface ErrorDetail {
  /** Error name */
  name: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error code */
  code?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================================================
// Memory Analysis Interfaces
// ============================================================================

/**
 * Memory report from analysis
 */
export interface MemoryReport {
  /** Report timestamp */
  timestamp: Date;
  /** Overall memory usage */
  overall: MemorySnapshot;
  /** Usage by category */
  byCategory: Record<AllocationCategory, number>;
  /** Top allocations */
  topAllocations: AllocationInfo[];
  /** Memory trend (last N samples) */
  trend: MemoryTrendPoint[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Allocation information
 */
export interface AllocationInfo {
  /** Allocation description */
  description: string;
  /** Category */
  category: AllocationCategory;
  /** Size in bytes */
  size: number;
  /** Allocation count */
  count: number;
  /** Source location (if available) */
  source?: string;
}

/**
 * Memory trend point
 */
export interface MemoryTrendPoint {
  /** Timestamp */
  timestamp: Date;
  /** Heap used */
  heapUsed: number;
  /** Heap total */
  heapTotal: number;
  /** External */
  external: number;
}

/**
 * Memory leak report
 */
export interface LeakReport {
  /** Report timestamp */
  timestamp: Date;
  /** Analysis duration in ms */
  analysisDuration: number;
  /** Leaks detected */
  leaksDetected: boolean;
  /** Suspected leaks */
  suspectedLeaks: SuspectedLeak[];
  /** Memory growth rate (bytes/second) */
  growthRate: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Suspected memory leak
 */
export interface SuspectedLeak {
  /** Description */
  description: string;
  /** Category */
  category: AllocationCategory;
  /** Growth pattern */
  growthPattern: string;
  /** Estimated size */
  estimatedSize: number;
  /** Confidence (0-1) */
  confidence: number;
  /** Suggested fix */
  suggestedFix?: string;
}

// ============================================================================
// Profiling Interfaces
// ============================================================================

/**
 * Profile options
 */
export interface ProfileOptions {
  /** Metrics to capture */
  metrics?: ProfileMetricType[];
  /** Sample interval in ms */
  sampleInterval?: number;
  /** Include call graph */
  includeCallGraph?: boolean;
  /** Max samples to capture */
  maxSamples?: number;
  /** Profile specific agent */
  agentId?: string;
}

/**
 * Profile session
 */
export interface ProfileSession {
  /** Session ID */
  sessionId: string;
  /** Session start time */
  startTime: Date;
  /** Session end time (if stopped) */
  endTime?: Date;
  /** Is active */
  isActive: boolean;
  /** Options used */
  options: ProfileOptions;
  /** Sample count */
  sampleCount: number;
}

/**
 * Profile report
 */
export interface ProfileReport {
  /** Session ID */
  sessionId: string;
  /** Profile duration in ms */
  duration: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** CPU metrics */
  cpu: CPUMetrics;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** Latency metrics */
  latency: LatencyMetrics;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
  /** Call graph (if captured) */
  callGraph?: CallGraphNode[];
  /** Hotspots */
  hotspots: Hotspot[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * CPU metrics
 */
export interface CPUMetrics {
  /** Average CPU usage percentage */
  averageUsage: number;
  /** Peak CPU usage percentage */
  peakUsage: number;
  /** User CPU time in ms */
  userTime: number;
  /** System CPU time in ms */
  systemTime: number;
  /** Samples */
  samples: { timestamp: Date; usage: number }[];
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  /** Average heap used */
  averageHeapUsed: number;
  /** Peak heap used */
  peakHeapUsed: number;
  /** Memory allocations */
  allocations: number;
  /** Memory deallocations */
  deallocations: number;
  /** GC pauses (ms) */
  gcPauses: number[];
  /** Samples */
  samples: MemoryTrendPoint[];
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  /** Average latency in ms */
  average: number;
  /** Median latency in ms */
  median: number;
  /** 95th percentile latency */
  p95: number;
  /** 99th percentile latency */
  p99: number;
  /** Max latency */
  max: number;
  /** Min latency */
  min: number;
  /** Samples */
  samples: { timestamp: Date; latency: number }[];
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
  /** Tasks per second */
  tasksPerSecond: number;
  /** Tools per second */
  toolsPerSecond: number;
  /** LLM calls per second */
  llmCallsPerSecond: number;
  /** Bytes processed per second */
  bytesPerSecond: number;
}

/**
 * Call graph node
 */
export interface CallGraphNode {
  /** Function/method name */
  name: string;
  /** Self time in ms */
  selfTime: number;
  /** Total time in ms */
  totalTime: number;
  /** Call count */
  callCount: number;
  /** Children nodes */
  children: CallGraphNode[];
}

/**
 * Performance hotspot
 */
export interface Hotspot {
  /** Name */
  name: string;
  /** Type (function, method, etc.) */
  type: string;
  /** Time spent (ms) */
  timeSpent: number;
  /** Percentage of total time */
  percentage: number;
  /** Call count */
  callCount: number;
  /** Optimization suggestion */
  suggestion?: string;
}

// ============================================================================
// Debug Toolkit Interface
// ============================================================================

/**
 * Debug Toolkit Interface
 *
 * Provides comprehensive debugging capabilities for agents including
 * tracing, state inspection, memory analysis, and profiling.
 */
export interface IDebugToolkit {
  // === Agent Tracing ===

  /**
   * Start tracing an agent
   */
  traceAgent(agentId: string, options?: TraceOptions): AgentTrace;

  /**
   * Stop an active trace
   */
  stopTrace(traceId: string): void;

  /**
   * Get trace log for export
   */
  getTraceLog(traceId: string): TraceLog;

  /**
   * Get all active traces
   */
  getActiveTraces(): AgentTrace[];

  /**
   * Clear trace data
   */
  clearTrace(traceId: string): void;

  // === State Inspection ===

  /**
   * Inspect agent state
   */
  inspectAgentState(agentId: string): AgentStateSnapshot;

  /**
   * Inspect tool execution
   */
  inspectToolExecution(executionId: string): ToolExecutionDetail;

  /**
   * Inspect LLM call
   */
  inspectLLMCall(callId: string): LLMCallDetail;

  /**
   * Get all tool executions for an agent
   */
  getToolExecutions(agentId: string, limit?: number): ToolExecutionDetail[];

  /**
   * Get all LLM calls for an agent
   */
  getLLMCalls(agentId: string, limit?: number): LLMCallDetail[];

  // === Memory Analysis ===

  /**
   * Analyze memory usage
   */
  analyzeMemoryUsage(): MemoryReport;

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(): Promise<LeakReport>;

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean;

  /**
   * Get memory snapshot
   */
  getMemorySnapshot(): MemorySnapshot;

  // === Performance Profiling ===

  /**
   * Start profiling session
   */
  startProfiling(options?: ProfileOptions): ProfileSession;

  /**
   * Stop profiling session
   */
  stopProfiling(sessionId: string): ProfileReport;

  /**
   * Get active profile sessions
   */
  getActiveProfiles(): ProfileSession[];

  // === Debug Output ===

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void;

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel;

  /**
   * Enable verbose mode
   */
  enableVerboseMode(): void;

  /**
   * Disable verbose mode
   */
  disableVerboseMode(): void;

  /**
   * Check if verbose mode is enabled
   */
  isVerboseMode(): boolean;

  // === Event Subscription ===

  /**
   * Subscribe to trace events
   */
  onTraceEvent(callback: (event: TraceEvent) => void): () => void;

  /**
   * Subscribe to profile samples
   */
  onProfileSample(callback: (sample: ProfileSample) => void): () => void;
}

/**
 * Profile sample emitted during profiling
 */
export interface ProfileSample {
  /** Timestamp */
  timestamp: Date;
  /** CPU usage */
  cpuUsage: number;
  /** Memory snapshot */
  memory: MemorySnapshot;
  /** Active tasks */
  activeTasks: number;
}

/**
 * Debug Toolkit Module
 *
 * Provides comprehensive debugging capabilities for agents including
 * tracing, state inspection, memory analysis, and profiling.
 *
 * Feature: F3.21 - Debug Toolkit
 * @module dx/debug-toolkit
 */

// Export all interfaces
export {
  // Enums
  LogLevel,
  TraceEventType,
  AllocationCategory,
  ProfileMetricType,
  // Tracing interfaces
  type TraceOptions,
  type TraceEvent,
  type AgentTrace,
  type TraceStatistics,
  type TraceLog,
  // State inspection interfaces
  type AgentStateSnapshot,
  type TaskSnapshot,
  type HealthSnapshot,
  type MemorySnapshot,
  type ToolExecutionDetail,
  type LLMCallDetail,
  type MessageSummary,
  type TokenUsageDetail,
  type ErrorDetail,
  // Memory analysis interfaces
  type MemoryReport,
  type AllocationInfo,
  type MemoryTrendPoint,
  type LeakReport,
  type SuspectedLeak,
  // Profiling interfaces
  type ProfileOptions,
  type ProfileSession,
  type ProfileReport,
  type CPUMetrics,
  type MemoryMetrics,
  type LatencyMetrics,
  type ThroughputMetrics,
  type CallGraphNode,
  type Hotspot,
  type ProfileSample,
  // Main interface
  type IDebugToolkit,
} from './interfaces';

// Export implementation
export { DebugToolkit, createDebugToolkit } from './impl';

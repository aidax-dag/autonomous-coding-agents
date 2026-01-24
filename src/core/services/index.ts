/**
 * Core Services Module
 *
 * Provides foundational services for the autonomous coding agents:
 *
 * ## Logging Service
 * - Structured logging with JSON/text formats
 * - Correlation IDs for distributed tracing
 * - Performance timing utilities
 * - Child loggers for component isolation
 *
 * ## Performance Profiler
 * - Method-level timing and statistics
 * - Memory usage tracking
 * - Percentile calculations (p50, p95, p99)
 * - Throughput measurement
 * - Performance report generation
 *
 * @example Quick Start
 * ```typescript
 * import {
 *   createLogger,
 *   createProfiler,
 *   setCorrelationId,
 * } from '@/core/services';
 *
 * // Logging
 * const logger = createLogger('MyService');
 * logger.info('Service started', { port: 3000 });
 *
 * // Profiling
 * const profiler = createProfiler();
 * const result = await profiler.timeAsync('db.query', () => db.query());
 * console.log(profiler.formatReport());
 *
 * // Request tracing
 * setCorrelationId('req-' + Date.now());
 * logger.info('Processing request'); // Includes correlation ID
 * ```
 *
 * @module core/services
 */

export { ILogger, LogLevel, type LogContext } from './logger.interface.js';
export {
  ConsoleLogger,
  configureLogger,
  createLogger,
  createCorrelatedLogger,
  setCorrelationId,
  getCorrelationId,
  clearCorrelationId,
  generateCorrelationId,
  LogFormat,
  type LoggerConfig,
  type StructuredLogEntry,
  type TimerResult,
} from './logger.js';

export {
  Profiler,
  createProfiler,
  getProfiler,
  resetGlobalProfiler,
  withProfiling,
  withProfilingSync,
  type ProfilerConfig,
  type PerformanceMetric,
  type PerformanceReport,
  type MetricSummary,
  type MemorySnapshot,
  type MemoryStats,
  type SystemInfo,
} from './profiler.js';

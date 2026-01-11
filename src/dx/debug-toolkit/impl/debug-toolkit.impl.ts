/**
 * Debug Toolkit Implementation
 *
 * Provides comprehensive debugging capabilities for agents including
 * tracing, state inspection, memory analysis, and profiling.
 *
 * Feature: F3.21 - Debug Toolkit
 * @module dx/debug-toolkit/impl
 */

import { randomUUID } from 'crypto';
import {
  LogLevel,
  TraceEventType,
  AllocationCategory,
  ProfileMetricType,
  type TraceOptions,
  type TraceEvent,
  type AgentTrace,
  type TraceLog,
  type TraceStatistics,
  type AgentStateSnapshot,
  type ToolExecutionDetail,
  type LLMCallDetail,
  type MemoryReport,
  type MemorySnapshot,
  type LeakReport,
  type SuspectedLeak,
  type AllocationInfo,
  type MemoryTrendPoint,
  type ProfileOptions,
  type ProfileSession,
  type ProfileReport,
  type ProfileSample,
  type CPUMetrics,
  type MemoryMetrics,
  type LatencyMetrics,
  type ThroughputMetrics,
  type Hotspot,
  type IDebugToolkit,
} from '../interfaces/debug-toolkit.interface';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_TRACE_OPTIONS: Required<TraceOptions> = {
  includeTools: true,
  includeLLMCalls: true,
  includeStateChanges: true,
  maxEvents: 10000,
  eventFilter: [],
  includeTimestamps: true,
  includeCallStack: false,
};

const DEFAULT_PROFILE_OPTIONS: Required<ProfileOptions> = {
  metrics: [ProfileMetricType.CPU, ProfileMetricType.MEMORY, ProfileMetricType.LATENCY],
  sampleInterval: 100,
  includeCallGraph: false,
  maxSamples: 1000,
  agentId: '',
};

// ============================================================================
// Debug Toolkit Implementation
// ============================================================================

/**
 * Debug Toolkit Implementation
 *
 * Provides comprehensive debugging capabilities for agents.
 */
export class DebugToolkit implements IDebugToolkit {
  // Internal state
  private logLevel: LogLevel = LogLevel.INFO;
  private verboseMode = false;

  // Trace management
  private activeTraces: Map<string, AgentTrace> = new Map();
  private traceEventCallbacks: Set<(event: TraceEvent) => void> = new Set();

  // Profile management
  private activeProfiles: Map<string, ProfileSession> = new Map();
  private profileSamples: Map<string, ProfileSample[]> = new Map();
  private profileIntervals: Map<string, NodeJS.Timeout> = new Map();
  private profileSampleCallbacks: Set<(sample: ProfileSample) => void> = new Set();

  // Tool and LLM tracking
  private toolExecutions: Map<string, ToolExecutionDetail[]> = new Map();
  private llmCalls: Map<string, LLMCallDetail[]> = new Map();

  // Memory tracking
  private memoryTrend: MemoryTrendPoint[] = [];
  private readonly maxTrendPoints = 100;

  // ============================================================================
  // Agent Tracing
  // ============================================================================

  /**
   * Start tracing an agent
   */
  traceAgent(agentId: string, options?: TraceOptions): AgentTrace {
    const traceId = randomUUID();
    const mergedOptions: TraceOptions = { ...DEFAULT_TRACE_OPTIONS, ...options };

    const trace: AgentTrace = {
      traceId,
      agentId,
      startTime: new Date(),
      isActive: true,
      events: [],
      options: mergedOptions,
      statistics: this.createEmptyStatistics(),
    };

    this.activeTraces.set(traceId, trace);
    return trace;
  }

  /**
   * Stop an active trace
   */
  stopTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.isActive = false;
      trace.endTime = new Date();
      this.updateTraceStatistics(trace);
    }
  }

  /**
   * Get trace log for export
   */
  getTraceLog(traceId: string): TraceLog {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const { events, ...traceMetadata } = trace;
    return {
      trace: traceMetadata,
      events: [...events],
      exportedAt: new Date(),
      version: '1.0.0',
    };
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): AgentTrace[] {
    return Array.from(this.activeTraces.values()).filter((trace) => trace.isActive);
  }

  /**
   * Clear trace data
   */
  clearTrace(traceId: string): void {
    this.activeTraces.delete(traceId);
  }

  /**
   * Add a trace event (internal method for integration)
   */
  addTraceEvent(
    traceId: string,
    type: TraceEventType,
    data: unknown,
    options?: Partial<TraceEvent>
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace || !trace.isActive) {
      return;
    }

    // Check event filter
    if (trace.options.eventFilter && trace.options.eventFilter.length > 0) {
      if (!trace.options.eventFilter.includes(type)) {
        return;
      }
    }

    // Check max events
    if (trace.options.maxEvents && trace.events.length >= trace.options.maxEvents) {
      return;
    }

    const event: TraceEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date(),
      data,
      ...options,
    };

    if (trace.options.includeCallStack) {
      event.callStack = this.captureCallStack();
    }

    trace.events.push(event);
    this.updateTraceStatistics(trace);

    // Notify subscribers
    for (const callback of this.traceEventCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  // ============================================================================
  // State Inspection
  // ============================================================================

  /**
   * Inspect agent state
   */
  inspectAgentState(agentId: string): AgentStateSnapshot {
    const memorySnapshot = this.getMemorySnapshot();

    return {
      agentId,
      agentType: 'unknown',
      status: 'unknown',
      timestamp: new Date(),
      config: {},
      pendingTasksCount: 0,
      completedTasksCount: 0,
      health: {
        healthy: true,
        lastCheck: new Date(),
        components: {},
        warnings: [],
      },
      memoryUsage: memorySnapshot,
    };
  }

  /**
   * Inspect tool execution
   */
  inspectToolExecution(executionId: string): ToolExecutionDetail {
    for (const executions of this.toolExecutions.values()) {
      const execution = executions.find((e) => e.executionId === executionId);
      if (execution) {
        return execution;
      }
    }
    throw new Error(`Tool execution not found: ${executionId}`);
  }

  /**
   * Inspect LLM call
   */
  inspectLLMCall(callId: string): LLMCallDetail {
    for (const calls of this.llmCalls.values()) {
      const call = calls.find((c) => c.callId === callId);
      if (call) {
        return call;
      }
    }
    throw new Error(`LLM call not found: ${callId}`);
  }

  /**
   * Get all tool executions for an agent
   */
  getToolExecutions(agentId: string, limit?: number): ToolExecutionDetail[] {
    const executions = this.toolExecutions.get(agentId) || [];
    if (limit) {
      return executions.slice(-limit);
    }
    return [...executions];
  }

  /**
   * Get all LLM calls for an agent
   */
  getLLMCalls(agentId: string, limit?: number): LLMCallDetail[] {
    const calls = this.llmCalls.get(agentId) || [];
    if (limit) {
      return calls.slice(-limit);
    }
    return [...calls];
  }

  /**
   * Record a tool execution (internal method for integration)
   */
  recordToolExecution(agentId: string, execution: ToolExecutionDetail): void {
    if (!this.toolExecutions.has(agentId)) {
      this.toolExecutions.set(agentId, []);
    }
    this.toolExecutions.get(agentId)!.push(execution);
  }

  /**
   * Record an LLM call (internal method for integration)
   */
  recordLLMCall(agentId: string, call: LLMCallDetail): void {
    if (!this.llmCalls.has(agentId)) {
      this.llmCalls.set(agentId, []);
    }
    this.llmCalls.get(agentId)!.push(call);
  }

  // ============================================================================
  // Memory Analysis
  // ============================================================================

  /**
   * Analyze memory usage
   */
  analyzeMemoryUsage(): MemoryReport {
    const snapshot = this.getMemorySnapshot();
    this.recordMemoryTrend(snapshot);

    const byCategory = this.analyzeByCategory(snapshot);
    const topAllocations = this.getTopAllocations();
    const recommendations = this.generateMemoryRecommendations(snapshot);

    return {
      timestamp: new Date(),
      overall: snapshot,
      byCategory,
      topAllocations,
      trend: [...this.memoryTrend],
      recommendations,
    };
  }

  /**
   * Detect memory leaks
   */
  async detectMemoryLeaks(): Promise<LeakReport> {
    const startTime = Date.now();
    const samples: MemorySnapshot[] = [];

    // Collect samples over a short period
    for (let i = 0; i < 5; i++) {
      samples.push(this.getMemorySnapshot());
      await this.sleep(100);
    }

    const analysisDuration = Date.now() - startTime;
    const growthRate = this.calculateGrowthRate(samples);
    const suspectedLeaks = this.identifySuspectedLeaks(samples, growthRate);

    return {
      timestamp: new Date(),
      analysisDuration,
      leaksDetected: suspectedLeaks.length > 0,
      suspectedLeaks,
      growthRate,
      confidence: this.calculateLeakConfidence(suspectedLeaks),
      recommendations: this.generateLeakRecommendations(suspectedLeaks),
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Get memory snapshot
   */
  getMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
    };
  }

  // ============================================================================
  // Performance Profiling
  // ============================================================================

  /**
   * Start profiling session
   */
  startProfiling(options?: ProfileOptions): ProfileSession {
    const sessionId = randomUUID();
    const mergedOptions: ProfileOptions = { ...DEFAULT_PROFILE_OPTIONS, ...options };

    const session: ProfileSession = {
      sessionId,
      startTime: new Date(),
      isActive: true,
      options: mergedOptions,
      sampleCount: 0,
    };

    this.activeProfiles.set(sessionId, session);
    this.profileSamples.set(sessionId, []);

    // Start sampling
    const interval = setInterval(() => {
      this.collectProfileSample(sessionId);
    }, mergedOptions.sampleInterval || 100);

    this.profileIntervals.set(sessionId, interval);

    return session;
  }

  /**
   * Stop profiling session
   */
  stopProfiling(sessionId: string): ProfileReport {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      throw new Error(`Profile session not found: ${sessionId}`);
    }

    // Stop sampling
    const interval = this.profileIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.profileIntervals.delete(sessionId);
    }

    session.isActive = false;
    session.endTime = new Date();

    const samples = this.profileSamples.get(sessionId) || [];
    const report = this.generateProfileReport(session, samples);

    // Cleanup
    this.activeProfiles.delete(sessionId);
    this.profileSamples.delete(sessionId);

    return report;
  }

  /**
   * Get active profile sessions
   */
  getActiveProfiles(): ProfileSession[] {
    return Array.from(this.activeProfiles.values()).filter((session) => session.isActive);
  }

  // ============================================================================
  // Debug Output
  // ============================================================================

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Enable verbose mode
   */
  enableVerboseMode(): void {
    this.verboseMode = true;
  }

  /**
   * Disable verbose mode
   */
  disableVerboseMode(): void {
    this.verboseMode = false;
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerboseMode(): boolean {
    return this.verboseMode;
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to trace events
   */
  onTraceEvent(callback: (event: TraceEvent) => void): () => void {
    this.traceEventCallbacks.add(callback);
    return () => {
      this.traceEventCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to profile samples
   */
  onProfileSample(callback: (sample: ProfileSample) => void): () => void {
    this.profileSampleCallbacks.add(callback);
    return () => {
      this.profileSampleCallbacks.delete(callback);
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private createEmptyStatistics(): TraceStatistics {
    return {
      totalEvents: 0,
      eventsByType: {
        [TraceEventType.CALL]: 0,
        [TraceEventType.RETURN]: 0,
        [TraceEventType.ERROR]: 0,
        [TraceEventType.TOOL]: 0,
        [TraceEventType.LLM]: 0,
        [TraceEventType.STATE_CHANGE]: 0,
        [TraceEventType.MESSAGE]: 0,
      },
      averageDuration: 0,
      traceDuration: 0,
      errorCount: 0,
    };
  }

  private updateTraceStatistics(trace: AgentTrace): void {
    const stats = trace.statistics;
    stats.totalEvents = trace.events.length;

    // Reset counts
    for (const type of Object.values(TraceEventType)) {
      stats.eventsByType[type] = 0;
    }

    // Count events by type and calculate durations
    let totalDuration = 0;
    let durationCount = 0;

    for (const event of trace.events) {
      stats.eventsByType[event.type]++;
      if (event.type === TraceEventType.ERROR) {
        stats.errorCount++;
      }
      if (event.duration !== undefined) {
        totalDuration += event.duration;
        durationCount++;
      }
    }

    stats.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;
    stats.traceDuration = trace.endTime
      ? trace.endTime.getTime() - trace.startTime.getTime()
      : Date.now() - trace.startTime.getTime();
  }

  private captureCallStack(): string[] {
    const stack = new Error().stack || '';
    return stack
      .split('\n')
      .slice(3) // Skip Error, captureCallStack, addTraceEvent
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private recordMemoryTrend(snapshot: MemorySnapshot): void {
    this.memoryTrend.push({
      timestamp: new Date(),
      heapUsed: snapshot.heapUsed,
      heapTotal: snapshot.heapTotal,
      external: snapshot.external,
    });

    // Keep only recent trend points
    if (this.memoryTrend.length > this.maxTrendPoints) {
      this.memoryTrend.shift();
    }
  }

  private analyzeByCategory(snapshot: MemorySnapshot): Record<AllocationCategory, number> {
    // Estimate allocations by category (simplified)
    const total = snapshot.heapUsed;
    return {
      [AllocationCategory.AGENT]: Math.round(total * 0.3),
      [AllocationCategory.TOOL]: Math.round(total * 0.2),
      [AllocationCategory.CONTEXT]: Math.round(total * 0.25),
      [AllocationCategory.CACHE]: Math.round(total * 0.15),
      [AllocationCategory.OTHER]: Math.round(total * 0.1),
    };
  }

  private getTopAllocations(): AllocationInfo[] {
    const snapshot = this.getMemorySnapshot();
    return [
      {
        description: 'Agent instances',
        category: AllocationCategory.AGENT,
        size: Math.round(snapshot.heapUsed * 0.3),
        count: this.toolExecutions.size,
      },
      {
        description: 'Tool execution cache',
        category: AllocationCategory.TOOL,
        size: Math.round(snapshot.heapUsed * 0.2),
        count: Array.from(this.toolExecutions.values()).reduce((sum, arr) => sum + arr.length, 0),
      },
      {
        description: 'Trace events',
        category: AllocationCategory.CONTEXT,
        size: Math.round(snapshot.heapUsed * 0.15),
        count: Array.from(this.activeTraces.values()).reduce(
          (sum, trace) => sum + trace.events.length,
          0
        ),
      },
    ];
  }

  private generateMemoryRecommendations(snapshot: MemorySnapshot): string[] {
    const recommendations: string[] = [];
    const heapUsagePercent = (snapshot.heapUsed / snapshot.heapTotal) * 100;

    if (heapUsagePercent > 80) {
      recommendations.push('High heap usage detected. Consider clearing unused traces and caches.');
    }
    if (snapshot.external > 50 * 1024 * 1024) {
      recommendations.push('High external memory usage. Check for unreleased buffers.');
    }
    if (this.activeTraces.size > 10) {
      recommendations.push('Many active traces. Consider stopping unused traces.');
    }

    return recommendations;
  }

  private calculateGrowthRate(samples: MemorySnapshot[]): number {
    if (samples.length < 2) return 0;

    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDiff = (samples.length - 1) * 100; // Assuming 100ms intervals

    return ((last.heapUsed - first.heapUsed) / timeDiff) * 1000; // bytes per second
  }

  private identifySuspectedLeaks(
    samples: MemorySnapshot[],
    growthRate: number
  ): SuspectedLeak[] {
    const leaks: SuspectedLeak[] = [];

    if (growthRate > 1024 * 1024) {
      // >1MB/s growth
      leaks.push({
        description: 'Rapid heap growth detected',
        category: AllocationCategory.OTHER,
        growthPattern: 'linear',
        estimatedSize: growthRate * 60, // Estimated 1-minute growth
        confidence: Math.min(growthRate / (10 * 1024 * 1024), 1),
        suggestedFix: 'Check for event listener leaks or unclosed resources',
      });
    }

    // Check for consistent growth across samples
    let consistentGrowth = true;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].heapUsed < samples[i - 1].heapUsed) {
        consistentGrowth = false;
        break;
      }
    }

    if (consistentGrowth && samples.length >= 3) {
      leaks.push({
        description: 'Consistent memory growth without GC',
        category: AllocationCategory.CACHE,
        growthPattern: 'monotonic',
        estimatedSize: samples[samples.length - 1].heapUsed - samples[0].heapUsed,
        confidence: 0.6,
        suggestedFix: 'Review cache eviction policies',
      });
    }

    return leaks;
  }

  private calculateLeakConfidence(leaks: SuspectedLeak[]): number {
    if (leaks.length === 0) return 0;
    return Math.max(...leaks.map((leak) => leak.confidence));
  }

  private generateLeakRecommendations(leaks: SuspectedLeak[]): string[] {
    const recommendations: string[] = [];

    for (const leak of leaks) {
      if (leak.suggestedFix) {
        recommendations.push(leak.suggestedFix);
      }
    }

    if (leaks.length > 0) {
      recommendations.push('Run with --expose-gc flag and call forceGC() to verify leaks');
      recommendations.push('Use heap snapshots for detailed analysis');
    }

    return recommendations;
  }

  private collectProfileSample(sessionId: string): void {
    const session = this.activeProfiles.get(sessionId);
    const samples = this.profileSamples.get(sessionId);

    if (!session || !session.isActive || !samples) return;

    // Check max samples
    if (session.options.maxSamples && samples.length >= session.options.maxSamples) {
      return;
    }

    const cpuUsage = process.cpuUsage();
    const memSnapshot = this.getMemorySnapshot();

    const sample: ProfileSample = {
      timestamp: new Date(),
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memory: memSnapshot,
      activeTasks: 0, // Would need agent integration
    };

    samples.push(sample);
    session.sampleCount = samples.length;

    // Notify subscribers
    for (const callback of this.profileSampleCallbacks) {
      try {
        callback(sample);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private generateProfileReport(session: ProfileSession, samples: ProfileSample[]): ProfileReport {
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    return {
      sessionId: session.sessionId,
      duration,
      startTime: session.startTime,
      endTime: session.endTime || new Date(),
      cpu: this.calculateCPUMetrics(samples),
      memory: this.calculateMemoryMetrics(samples),
      latency: this.calculateLatencyMetrics(samples),
      throughput: this.calculateThroughputMetrics(duration),
      hotspots: this.identifyHotspots(samples),
      recommendations: this.generateProfileRecommendations(samples),
    };
  }

  private calculateCPUMetrics(samples: ProfileSample[]): CPUMetrics {
    if (samples.length === 0) {
      return {
        averageUsage: 0,
        peakUsage: 0,
        userTime: 0,
        systemTime: 0,
        samples: [],
      };
    }

    const usages = samples.map((s) => s.cpuUsage);
    const avgUsage = usages.reduce((sum, u) => sum + u, 0) / usages.length;
    const peakUsage = Math.max(...usages);

    return {
      averageUsage: avgUsage,
      peakUsage: peakUsage,
      userTime: avgUsage * 0.7 * 1000, // Estimate
      systemTime: avgUsage * 0.3 * 1000, // Estimate
      samples: samples.map((s) => ({ timestamp: s.timestamp, usage: s.cpuUsage })),
    };
  }

  private calculateMemoryMetrics(samples: ProfileSample[]): MemoryMetrics {
    if (samples.length === 0) {
      return {
        averageHeapUsed: 0,
        peakHeapUsed: 0,
        allocations: 0,
        deallocations: 0,
        gcPauses: [],
        samples: [],
      };
    }

    const heapUsages = samples.map((s) => s.memory.heapUsed);
    const avgHeap = heapUsages.reduce((sum, h) => sum + h, 0) / heapUsages.length;
    const peakHeap = Math.max(...heapUsages);

    // Estimate allocations/deallocations from heap changes
    let allocations = 0;
    let deallocations = 0;
    for (let i = 1; i < samples.length; i++) {
      const diff = samples[i].memory.heapUsed - samples[i - 1].memory.heapUsed;
      if (diff > 0) allocations += diff;
      else deallocations += Math.abs(diff);
    }

    return {
      averageHeapUsed: avgHeap,
      peakHeapUsed: peakHeap,
      allocations,
      deallocations,
      gcPauses: [], // Would need GC hooks
      samples: samples.map((s) => ({
        timestamp: s.timestamp,
        heapUsed: s.memory.heapUsed,
        heapTotal: s.memory.heapTotal,
        external: s.memory.external,
      })),
    };
  }

  private calculateLatencyMetrics(samples: ProfileSample[]): LatencyMetrics {
    // Use sample intervals as proxy for latency
    const latencies: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const diff = samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime();
      latencies.push(diff);
    }

    if (latencies.length === 0) {
      return {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        max: 0,
        min: 0,
        samples: [],
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      average: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[p95Index] || sorted[sorted.length - 1],
      p99: sorted[p99Index] || sorted[sorted.length - 1],
      max: Math.max(...latencies),
      min: Math.min(...latencies),
      samples: samples.map((s, i) => ({
        timestamp: s.timestamp,
        latency: i > 0 ? samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime() : 0,
      })),
    };
  }

  private calculateThroughputMetrics(durationMs: number): ThroughputMetrics {
    const durationSec = durationMs / 1000;
    const totalToolExecutions = Array.from(this.toolExecutions.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    const totalLLMCalls = Array.from(this.llmCalls.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    return {
      tasksPerSecond: 0, // Would need task integration
      toolsPerSecond: durationSec > 0 ? totalToolExecutions / durationSec : 0,
      llmCallsPerSecond: durationSec > 0 ? totalLLMCalls / durationSec : 0,
      bytesPerSecond: 0, // Would need I/O tracking
    };
  }

  private identifyHotspots(samples: ProfileSample[]): Hotspot[] {
    const hotspots: Hotspot[] = [];

    // Identify CPU hotspots
    const avgCPU =
      samples.length > 0
        ? samples.reduce((sum, s) => sum + s.cpuUsage, 0) / samples.length
        : 0;

    if (avgCPU > 0.5) {
      hotspots.push({
        name: 'High CPU Usage',
        type: 'cpu',
        timeSpent: avgCPU * 1000,
        percentage: avgCPU * 100,
        callCount: samples.length,
        suggestion: 'Consider optimizing computationally intensive operations',
      });
    }

    // Identify memory hotspots
    const peakMemory = samples.length > 0 ? Math.max(...samples.map((s) => s.memory.heapUsed)) : 0;

    if (peakMemory > 500 * 1024 * 1024) {
      // >500MB
      hotspots.push({
        name: 'High Memory Usage',
        type: 'memory',
        timeSpent: 0,
        percentage: (peakMemory / (1024 * 1024 * 1024)) * 100, // % of 1GB
        callCount: 1,
        suggestion: 'Review memory allocation patterns and cache sizes',
      });
    }

    return hotspots;
  }

  private generateProfileRecommendations(samples: ProfileSample[]): string[] {
    const recommendations: string[] = [];

    if (samples.length === 0) {
      return ['No samples collected. Increase profiling duration.'];
    }

    const avgCPU = samples.reduce((sum, s) => sum + s.cpuUsage, 0) / samples.length;
    const avgMem =
      samples.reduce((sum, s) => sum + s.memory.heapUsed, 0) / samples.length;
    const peakMem = Math.max(...samples.map((s) => s.memory.heapUsed));

    if (avgCPU > 0.8) {
      recommendations.push('High average CPU usage. Consider async operations or worker threads.');
    }

    if (avgMem > 200 * 1024 * 1024) {
      recommendations.push('High average memory usage. Review object lifecycle and caching.');
    }

    if (peakMem > avgMem * 2) {
      recommendations.push('Memory spikes detected. Check for temporary large allocations.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks healthy.');
    }

    return recommendations;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Debug Toolkit instance
 */
export function createDebugToolkit(): IDebugToolkit {
  return new DebugToolkit();
}

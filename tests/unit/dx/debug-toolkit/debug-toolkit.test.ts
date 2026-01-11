/**
 * Debug Toolkit Tests
 *
 * Comprehensive tests for the Debug Toolkit module including
 * tracing, state inspection, memory analysis, and profiling.
 *
 * Feature: F3.21 - Debug Toolkit
 */

import {
  DebugToolkit,
  createDebugToolkit,
  LogLevel,
  TraceEventType,
  AllocationCategory,
  ProfileMetricType,
  type TraceOptions,
  type ToolExecutionDetail,
  type LLMCallDetail,
  type IDebugToolkit,
} from '../../../../src/dx/debug-toolkit';

describe('DebugToolkit', () => {
  let toolkit: DebugToolkit;

  beforeEach(() => {
    toolkit = new DebugToolkit();
  });

  afterEach(() => {
    // Clean up any active traces and profiles
    for (const trace of toolkit.getActiveTraces()) {
      toolkit.stopTrace(trace.traceId);
    }
    for (const profile of toolkit.getActiveProfiles()) {
      toolkit.stopProfiling(profile.sessionId);
    }
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createDebugToolkit', () => {
    it('should create a new DebugToolkit instance', () => {
      const instance = createDebugToolkit();
      expect(instance).toBeInstanceOf(DebugToolkit);
    });

    it('should implement IDebugToolkit interface', () => {
      const instance: IDebugToolkit = createDebugToolkit();
      expect(instance.traceAgent).toBeDefined();
      expect(instance.inspectAgentState).toBeDefined();
      expect(instance.analyzeMemoryUsage).toBeDefined();
      expect(instance.startProfiling).toBeDefined();
    });
  });

  // ============================================================================
  // Agent Tracing Tests
  // ============================================================================

  describe('Agent Tracing', () => {
    describe('traceAgent', () => {
      it('should start tracing an agent', () => {
        const trace = toolkit.traceAgent('agent-1');

        expect(trace).toBeDefined();
        expect(trace.traceId).toBeDefined();
        expect(trace.agentId).toBe('agent-1');
        expect(trace.isActive).toBe(true);
        expect(trace.events).toEqual([]);
        expect(trace.startTime).toBeInstanceOf(Date);
      });

      it('should use default options when none provided', () => {
        const trace = toolkit.traceAgent('agent-1');

        expect(trace.options.includeTools).toBe(true);
        expect(trace.options.includeLLMCalls).toBe(true);
        expect(trace.options.includeStateChanges).toBe(true);
        expect(trace.options.maxEvents).toBe(10000);
      });

      it('should merge custom options with defaults', () => {
        const customOptions: TraceOptions = {
          includeTools: false,
          maxEvents: 500,
        };
        const trace = toolkit.traceAgent('agent-1', customOptions);

        expect(trace.options.includeTools).toBe(false);
        expect(trace.options.maxEvents).toBe(500);
        expect(trace.options.includeLLMCalls).toBe(true); // default
      });

      it('should generate unique trace IDs', () => {
        const trace1 = toolkit.traceAgent('agent-1');
        const trace2 = toolkit.traceAgent('agent-2');

        expect(trace1.traceId).not.toBe(trace2.traceId);
      });

      it('should initialize statistics correctly', () => {
        const trace = toolkit.traceAgent('agent-1');

        expect(trace.statistics.totalEvents).toBe(0);
        expect(trace.statistics.errorCount).toBe(0);
        expect(trace.statistics.averageDuration).toBe(0);
      });
    });

    describe('stopTrace', () => {
      it('should stop an active trace', () => {
        const trace = toolkit.traceAgent('agent-1');
        toolkit.stopTrace(trace.traceId);

        const activeTraces = toolkit.getActiveTraces();
        expect(activeTraces).not.toContainEqual(
          expect.objectContaining({ traceId: trace.traceId })
        );
      });

      it('should set endTime when stopped', () => {
        const trace = toolkit.traceAgent('agent-1');
        toolkit.stopTrace(trace.traceId);

        // Get the trace log to check endTime
        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.trace.endTime).toBeInstanceOf(Date);
      });

      it('should mark trace as inactive', () => {
        const trace = toolkit.traceAgent('agent-1');
        toolkit.stopTrace(trace.traceId);

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.trace.isActive).toBe(false);
      });
    });

    describe('getTraceLog', () => {
      it('should return trace log for export', () => {
        const trace = toolkit.traceAgent('agent-1');
        const traceLog = toolkit.getTraceLog(trace.traceId);

        expect(traceLog.trace.traceId).toBe(trace.traceId);
        expect(traceLog.events).toEqual([]);
        expect(traceLog.exportedAt).toBeInstanceOf(Date);
        expect(traceLog.version).toBe('1.0.0');
      });

      it('should throw error for non-existent trace', () => {
        expect(() => toolkit.getTraceLog('non-existent')).toThrow('Trace not found');
      });
    });

    describe('getActiveTraces', () => {
      it('should return only active traces', () => {
        const trace1 = toolkit.traceAgent('agent-1');
        const trace2 = toolkit.traceAgent('agent-2');
        toolkit.stopTrace(trace1.traceId);

        const activeTraces = toolkit.getActiveTraces();
        expect(activeTraces.length).toBe(1);
        expect(activeTraces[0].traceId).toBe(trace2.traceId);
      });

      it('should return empty array when no active traces', () => {
        const activeTraces = toolkit.getActiveTraces();
        expect(activeTraces).toEqual([]);
      });
    });

    describe('clearTrace', () => {
      it('should remove trace data', () => {
        const trace = toolkit.traceAgent('agent-1');
        toolkit.clearTrace(trace.traceId);

        expect(() => toolkit.getTraceLog(trace.traceId)).toThrow('Trace not found');
      });
    });

    describe('addTraceEvent', () => {
      it('should add event to active trace', () => {
        const trace = toolkit.traceAgent('agent-1');
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { method: 'test' });

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.events.length).toBe(1);
        expect(traceLog.events[0].type).toBe(TraceEventType.CALL);
        expect(traceLog.events[0].data).toEqual({ method: 'test' });
      });

      it('should not add event to stopped trace', () => {
        const trace = toolkit.traceAgent('agent-1');
        toolkit.stopTrace(trace.traceId);
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { method: 'test' });

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.events.length).toBe(0);
      });

      it('should filter events based on eventFilter option', () => {
        const trace = toolkit.traceAgent('agent-1', {
          eventFilter: [TraceEventType.ERROR],
        });
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { method: 'test' });
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.ERROR, { error: 'test' });

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.events.length).toBe(1);
        expect(traceLog.events[0].type).toBe(TraceEventType.ERROR);
      });

      it('should respect maxEvents limit', () => {
        const trace = toolkit.traceAgent('agent-1', { maxEvents: 2 });
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { n: 1 });
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { n: 2 });
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { n: 3 });

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.events.length).toBe(2);
      });

      it('should update statistics when event is added', () => {
        const trace = toolkit.traceAgent('agent-1');
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, {});
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.ERROR, {});

        const traceLog = toolkit.getTraceLog(trace.traceId);
        expect(traceLog.trace.statistics.totalEvents).toBe(2);
        expect(traceLog.trace.statistics.eventsByType[TraceEventType.CALL]).toBe(1);
        expect(traceLog.trace.statistics.eventsByType[TraceEventType.ERROR]).toBe(1);
        expect(traceLog.trace.statistics.errorCount).toBe(1);
      });
    });

    describe('onTraceEvent', () => {
      it('should subscribe to trace events', () => {
        const callback = jest.fn();
        const unsubscribe = toolkit.onTraceEvent(callback);
        const trace = toolkit.traceAgent('agent-1');

        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, { test: true });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: TraceEventType.CALL,
            data: { test: true },
          })
        );

        unsubscribe();
      });

      it('should unsubscribe correctly', () => {
        const callback = jest.fn();
        const unsubscribe = toolkit.onTraceEvent(callback);
        const trace = toolkit.traceAgent('agent-1');

        unsubscribe();
        (toolkit as any).addTraceEvent(trace.traceId, TraceEventType.CALL, {});

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // State Inspection Tests
  // ============================================================================

  describe('State Inspection', () => {
    describe('inspectAgentState', () => {
      it('should return agent state snapshot', () => {
        const snapshot = toolkit.inspectAgentState('agent-1');

        expect(snapshot.agentId).toBe('agent-1');
        expect(snapshot.timestamp).toBeInstanceOf(Date);
        expect(snapshot.health).toBeDefined();
        expect(snapshot.memoryUsage).toBeDefined();
      });

      it('should include health information', () => {
        const snapshot = toolkit.inspectAgentState('agent-1');

        expect(snapshot.health.healthy).toBeDefined();
        expect(snapshot.health.lastCheck).toBeInstanceOf(Date);
        expect(snapshot.health.components).toBeDefined();
        expect(snapshot.health.warnings).toBeInstanceOf(Array);
      });
    });

    describe('Tool Execution Tracking', () => {
      it('should record tool execution', () => {
        const execution: ToolExecutionDetail = {
          executionId: 'exec-1',
          toolName: 'readFile',
          startTime: new Date(),
          duration: 100,
          input: { path: '/test.txt' },
          output: 'file contents',
          cached: false,
          retryCount: 0,
        };

        (toolkit as any).recordToolExecution('agent-1', execution);
        const executions = toolkit.getToolExecutions('agent-1');

        expect(executions.length).toBe(1);
        expect(executions[0]).toEqual(execution);
      });

      it('should inspect specific tool execution', () => {
        const execution: ToolExecutionDetail = {
          executionId: 'exec-1',
          toolName: 'readFile',
          startTime: new Date(),
          duration: 100,
          input: {},
          cached: false,
          retryCount: 0,
        };

        (toolkit as any).recordToolExecution('agent-1', execution);
        const result = toolkit.inspectToolExecution('exec-1');

        expect(result.executionId).toBe('exec-1');
      });

      it('should throw error for non-existent execution', () => {
        expect(() => toolkit.inspectToolExecution('non-existent')).toThrow(
          'Tool execution not found'
        );
      });

      it('should limit tool executions with limit parameter', () => {
        for (let i = 0; i < 5; i++) {
          (toolkit as any).recordToolExecution('agent-1', {
            executionId: `exec-${i}`,
            toolName: 'test',
            startTime: new Date(),
            duration: 10,
            input: {},
            cached: false,
            retryCount: 0,
          });
        }

        const limited = toolkit.getToolExecutions('agent-1', 3);
        expect(limited.length).toBe(3);
      });
    });

    describe('LLM Call Tracking', () => {
      it('should record LLM call', () => {
        const call: LLMCallDetail = {
          callId: 'call-1',
          provider: 'anthropic',
          model: 'claude-3-opus',
          startTime: new Date(),
          duration: 2000,
          messagesSummary: [{ role: 'user', contentLength: 100, preview: 'Hello...' }],
          tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          streamed: false,
        };

        (toolkit as any).recordLLMCall('agent-1', call);
        const calls = toolkit.getLLMCalls('agent-1');

        expect(calls.length).toBe(1);
        expect(calls[0]).toEqual(call);
      });

      it('should inspect specific LLM call', () => {
        const call: LLMCallDetail = {
          callId: 'call-1',
          provider: 'anthropic',
          model: 'claude-3-opus',
          startTime: new Date(),
          duration: 2000,
          messagesSummary: [],
          tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          streamed: false,
        };

        (toolkit as any).recordLLMCall('agent-1', call);
        const result = toolkit.inspectLLMCall('call-1');

        expect(result.callId).toBe('call-1');
        expect(result.provider).toBe('anthropic');
      });

      it('should throw error for non-existent LLM call', () => {
        expect(() => toolkit.inspectLLMCall('non-existent')).toThrow('LLM call not found');
      });
    });
  });

  // ============================================================================
  // Memory Analysis Tests
  // ============================================================================

  describe('Memory Analysis', () => {
    describe('getMemorySnapshot', () => {
      it('should return current memory snapshot', () => {
        const snapshot = toolkit.getMemorySnapshot();

        expect(snapshot.heapUsed).toBeGreaterThan(0);
        expect(snapshot.heapTotal).toBeGreaterThan(0);
        expect(snapshot.external).toBeGreaterThanOrEqual(0);
        expect(snapshot.arrayBuffers).toBeGreaterThanOrEqual(0);
        expect(snapshot.rss).toBeGreaterThan(0);
      });

      it('should have heapUsed <= heapTotal', () => {
        const snapshot = toolkit.getMemorySnapshot();
        expect(snapshot.heapUsed).toBeLessThanOrEqual(snapshot.heapTotal);
      });
    });

    describe('analyzeMemoryUsage', () => {
      it('should return memory report', () => {
        const report = toolkit.analyzeMemoryUsage();

        expect(report.timestamp).toBeInstanceOf(Date);
        expect(report.overall).toBeDefined();
        expect(report.byCategory).toBeDefined();
        expect(report.topAllocations).toBeInstanceOf(Array);
        expect(report.trend).toBeInstanceOf(Array);
        expect(report.recommendations).toBeInstanceOf(Array);
      });

      it('should include all allocation categories', () => {
        const report = toolkit.analyzeMemoryUsage();

        expect(report.byCategory[AllocationCategory.AGENT]).toBeDefined();
        expect(report.byCategory[AllocationCategory.TOOL]).toBeDefined();
        expect(report.byCategory[AllocationCategory.CONTEXT]).toBeDefined();
        expect(report.byCategory[AllocationCategory.CACHE]).toBeDefined();
        expect(report.byCategory[AllocationCategory.OTHER]).toBeDefined();
      });

      it('should update memory trend', () => {
        toolkit.analyzeMemoryUsage();
        toolkit.analyzeMemoryUsage();
        const report = toolkit.analyzeMemoryUsage();

        expect(report.trend.length).toBe(3);
      });
    });

    describe('detectMemoryLeaks', () => {
      it('should return leak report', async () => {
        const report = await toolkit.detectMemoryLeaks();

        expect(report.timestamp).toBeInstanceOf(Date);
        expect(report.analysisDuration).toBeGreaterThan(0);
        expect(typeof report.leaksDetected).toBe('boolean');
        expect(report.suspectedLeaks).toBeInstanceOf(Array);
        expect(typeof report.growthRate).toBe('number');
        expect(typeof report.confidence).toBe('number');
        expect(report.recommendations).toBeInstanceOf(Array);
      });

      it('should have confidence between 0 and 1', async () => {
        const report = await toolkit.detectMemoryLeaks();
        expect(report.confidence).toBeGreaterThanOrEqual(0);
        expect(report.confidence).toBeLessThanOrEqual(1);
      });
    });

    describe('forceGC', () => {
      it('should return false when GC is not exposed', () => {
        const result = toolkit.forceGC();
        // In normal Node.js environment without --expose-gc flag
        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Performance Profiling Tests
  // ============================================================================

  describe('Performance Profiling', () => {
    describe('startProfiling', () => {
      it('should start a profiling session', () => {
        const session = toolkit.startProfiling();

        expect(session.sessionId).toBeDefined();
        expect(session.isActive).toBe(true);
        expect(session.startTime).toBeInstanceOf(Date);
        expect(session.sampleCount).toBe(0);
      });

      it('should use default options', () => {
        const session = toolkit.startProfiling();

        expect(session.options.sampleInterval).toBe(100);
        expect(session.options.maxSamples).toBe(1000);
        expect(session.options.metrics).toContain(ProfileMetricType.CPU);
        expect(session.options.metrics).toContain(ProfileMetricType.MEMORY);
      });

      it('should accept custom options', () => {
        const session = toolkit.startProfiling({
          sampleInterval: 50,
          maxSamples: 500,
          agentId: 'agent-1',
        });

        expect(session.options.sampleInterval).toBe(50);
        expect(session.options.maxSamples).toBe(500);
        expect(session.options.agentId).toBe('agent-1');
      });
    });

    describe('stopProfiling', () => {
      it('should stop profiling and return report', async () => {
        const session = toolkit.startProfiling({ sampleInterval: 10 });
        await new Promise((r) => setTimeout(r, 50)); // Allow some samples
        const report = toolkit.stopProfiling(session.sessionId);

        expect(report.sessionId).toBe(session.sessionId);
        expect(report.duration).toBeGreaterThan(0);
        expect(report.startTime).toBeInstanceOf(Date);
        expect(report.endTime).toBeInstanceOf(Date);
        expect(report.cpu).toBeDefined();
        expect(report.memory).toBeDefined();
        expect(report.latency).toBeDefined();
        expect(report.throughput).toBeDefined();
      });

      it('should throw error for non-existent session', () => {
        expect(() => toolkit.stopProfiling('non-existent')).toThrow(
          'Profile session not found'
        );
      });

      it('should include hotspots in report', async () => {
        const session = toolkit.startProfiling({ sampleInterval: 10 });
        await new Promise((r) => setTimeout(r, 50));
        const report = toolkit.stopProfiling(session.sessionId);

        expect(report.hotspots).toBeInstanceOf(Array);
      });

      it('should include recommendations in report', async () => {
        const session = toolkit.startProfiling({ sampleInterval: 10 });
        await new Promise((r) => setTimeout(r, 50));
        const report = toolkit.stopProfiling(session.sessionId);

        expect(report.recommendations).toBeInstanceOf(Array);
        expect(report.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('getActiveProfiles', () => {
      it('should return active profile sessions', () => {
        const session1 = toolkit.startProfiling();
        const session2 = toolkit.startProfiling();

        const active = toolkit.getActiveProfiles();
        expect(active.length).toBe(2);
        expect(active.map((s) => s.sessionId)).toContain(session1.sessionId);
        expect(active.map((s) => s.sessionId)).toContain(session2.sessionId);
      });

      it('should not include stopped sessions', () => {
        const session1 = toolkit.startProfiling();
        const session2 = toolkit.startProfiling();
        toolkit.stopProfiling(session1.sessionId);

        const active = toolkit.getActiveProfiles();
        expect(active.length).toBe(1);
        expect(active[0].sessionId).toBe(session2.sessionId);
      });
    });

    describe('onProfileSample', () => {
      it('should subscribe to profile samples', async () => {
        const callback = jest.fn();
        const unsubscribe = toolkit.onProfileSample(callback);

        const session = toolkit.startProfiling({ sampleInterval: 10 });
        await new Promise((r) => setTimeout(r, 50));
        toolkit.stopProfiling(session.sessionId);

        expect(callback).toHaveBeenCalled();
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            timestamp: expect.any(Date),
            cpuUsage: expect.any(Number),
            memory: expect.any(Object),
          })
        );

        unsubscribe();
      });

      it('should unsubscribe correctly', async () => {
        const callback = jest.fn();
        const unsubscribe = toolkit.onProfileSample(callback);
        unsubscribe();

        const session = toolkit.startProfiling({ sampleInterval: 10 });
        await new Promise((r) => setTimeout(r, 50));
        toolkit.stopProfiling(session.sessionId);

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Debug Output Tests
  // ============================================================================

  describe('Debug Output', () => {
    describe('Log Level', () => {
      it('should default to INFO log level', () => {
        expect(toolkit.getLogLevel()).toBe(LogLevel.INFO);
      });

      it('should set log level', () => {
        toolkit.setLogLevel(LogLevel.DEBUG);
        expect(toolkit.getLogLevel()).toBe(LogLevel.DEBUG);
      });

      it('should accept all log levels', () => {
        const levels = [
          LogLevel.TRACE,
          LogLevel.DEBUG,
          LogLevel.INFO,
          LogLevel.WARN,
          LogLevel.ERROR,
          LogLevel.SILENT,
        ];

        for (const level of levels) {
          toolkit.setLogLevel(level);
          expect(toolkit.getLogLevel()).toBe(level);
        }
      });
    });

    describe('Verbose Mode', () => {
      it('should default to verbose mode disabled', () => {
        expect(toolkit.isVerboseMode()).toBe(false);
      });

      it('should enable verbose mode', () => {
        toolkit.enableVerboseMode();
        expect(toolkit.isVerboseMode()).toBe(true);
      });

      it('should disable verbose mode', () => {
        toolkit.enableVerboseMode();
        toolkit.disableVerboseMode();
        expect(toolkit.isVerboseMode()).toBe(false);
      });
    });
  });

  // ============================================================================
  // Enum Tests
  // ============================================================================

  describe('Enums', () => {
    describe('LogLevel', () => {
      it('should have correct values', () => {
        expect(LogLevel.TRACE).toBe('trace');
        expect(LogLevel.DEBUG).toBe('debug');
        expect(LogLevel.INFO).toBe('info');
        expect(LogLevel.WARN).toBe('warn');
        expect(LogLevel.ERROR).toBe('error');
        expect(LogLevel.SILENT).toBe('silent');
      });
    });

    describe('TraceEventType', () => {
      it('should have correct values', () => {
        expect(TraceEventType.CALL).toBe('call');
        expect(TraceEventType.RETURN).toBe('return');
        expect(TraceEventType.ERROR).toBe('error');
        expect(TraceEventType.TOOL).toBe('tool');
        expect(TraceEventType.LLM).toBe('llm');
        expect(TraceEventType.STATE_CHANGE).toBe('state_change');
        expect(TraceEventType.MESSAGE).toBe('message');
      });
    });

    describe('AllocationCategory', () => {
      it('should have correct values', () => {
        expect(AllocationCategory.AGENT).toBe('agent');
        expect(AllocationCategory.TOOL).toBe('tool');
        expect(AllocationCategory.CONTEXT).toBe('context');
        expect(AllocationCategory.CACHE).toBe('cache');
        expect(AllocationCategory.OTHER).toBe('other');
      });
    });

    describe('ProfileMetricType', () => {
      it('should have correct values', () => {
        expect(ProfileMetricType.CPU).toBe('cpu');
        expect(ProfileMetricType.MEMORY).toBe('memory');
        expect(ProfileMetricType.LATENCY).toBe('latency');
        expect(ProfileMetricType.THROUGHPUT).toBe('throughput');
      });
    });
  });

  // ============================================================================
  // Profile Report Metrics Tests
  // ============================================================================

  describe('Profile Report Metrics', () => {
    it('should calculate CPU metrics correctly', async () => {
      const session = toolkit.startProfiling({ sampleInterval: 10 });
      await new Promise((r) => setTimeout(r, 100));
      const report = toolkit.stopProfiling(session.sessionId);

      expect(report.cpu.averageUsage).toBeGreaterThanOrEqual(0);
      expect(report.cpu.peakUsage).toBeGreaterThanOrEqual(report.cpu.averageUsage);
      expect(report.cpu.samples).toBeInstanceOf(Array);
    });

    it('should calculate memory metrics correctly', async () => {
      const session = toolkit.startProfiling({ sampleInterval: 10 });
      await new Promise((r) => setTimeout(r, 100));
      const report = toolkit.stopProfiling(session.sessionId);

      expect(report.memory.averageHeapUsed).toBeGreaterThan(0);
      expect(report.memory.peakHeapUsed).toBeGreaterThanOrEqual(report.memory.averageHeapUsed);
      expect(report.memory.samples).toBeInstanceOf(Array);
    });

    it('should calculate latency metrics correctly', async () => {
      const session = toolkit.startProfiling({ sampleInterval: 10 });
      await new Promise((r) => setTimeout(r, 100));
      const report = toolkit.stopProfiling(session.sessionId);

      expect(report.latency.average).toBeGreaterThanOrEqual(0);
      expect(report.latency.min).toBeLessThanOrEqual(report.latency.max);
      expect(report.latency.p95).toBeGreaterThanOrEqual(report.latency.median);
    });

    it('should calculate throughput metrics', async () => {
      const session = toolkit.startProfiling({ sampleInterval: 10 });
      await new Promise((r) => setTimeout(r, 50));
      const report = toolkit.stopProfiling(session.sessionId);

      expect(report.throughput.tasksPerSecond).toBeDefined();
      expect(report.throughput.toolsPerSecond).toBeDefined();
      expect(report.throughput.llmCallsPerSecond).toBeDefined();
      expect(report.throughput.bytesPerSecond).toBeDefined();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle concurrent traces and profiles', async () => {
      // Start multiple traces
      const trace1 = toolkit.traceAgent('agent-1');
      const trace2 = toolkit.traceAgent('agent-2');

      // Start profile
      const profile = toolkit.startProfiling({ sampleInterval: 10 });

      // Add events to traces
      (toolkit as any).addTraceEvent(trace1.traceId, TraceEventType.CALL, { test: 1 });
      (toolkit as any).addTraceEvent(trace2.traceId, TraceEventType.CALL, { test: 2 });

      // Record executions
      (toolkit as any).recordToolExecution('agent-1', {
        executionId: 'exec-1',
        toolName: 'test',
        startTime: new Date(),
        duration: 10,
        input: {},
        cached: false,
        retryCount: 0,
      });

      await new Promise((r) => setTimeout(r, 50));

      // Stop all
      toolkit.stopTrace(trace1.traceId);
      toolkit.stopTrace(trace2.traceId);
      const report = toolkit.stopProfiling(profile.sessionId);

      // Verify results
      const log1 = toolkit.getTraceLog(trace1.traceId);
      const log2 = toolkit.getTraceLog(trace2.traceId);

      expect(log1.events.length).toBe(1);
      expect(log2.events.length).toBe(1);
      expect(report.duration).toBeGreaterThan(0);
      expect(toolkit.getToolExecutions('agent-1').length).toBe(1);
    });

    it('should track memory across multiple operations', () => {
      // First analysis
      toolkit.analyzeMemoryUsage();

      // Create some allocations
      const data: unknown[] = [];
      for (let i = 0; i < 10; i++) {
        data.push({ index: i, buffer: new Array(1000).fill(i) });
      }

      // Keep reference to avoid GC
      expect(data.length).toBe(10);

      // Second analysis
      const report = toolkit.analyzeMemoryUsage();

      // Trend should have increased
      expect(report.trend.length).toBe(2);
    });
  });
});

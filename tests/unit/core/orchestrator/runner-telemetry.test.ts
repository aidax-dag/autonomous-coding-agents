/**
 * OrchestratorRunner Telemetry Integration Tests (T13)
 */

import {
  createOrchestratorRunner,
} from '../../../../src/core/orchestrator/orchestrator-runner';
import type { ILLMClient, LLMCompletionResult } from '../../../../src/shared/llm/base-client';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('test'),
    getDefaultModel: jest.fn().mockReturnValue('test-model'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result":"ok"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(4096),
  };
}

describe('OrchestratorRunner Telemetry (T13)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'telemetry-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return null telemetry when enableTelemetry is false', () => {
    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      workspaceDir: tmpDir,
    });
    expect(runner.getTelemetry()).toBeNull();
  });

  it('should return OTelProvider when enableTelemetry is true', () => {
    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      workspaceDir: tmpDir,
      enableTelemetry: true,
    });
    const telemetry = runner.getTelemetry();
    expect(telemetry).not.toBeNull();
    expect(telemetry!.isEnabled()).toBe(true);
    expect(telemetry!.getServiceName()).toBe('aca-runner');
  });

  it('should have trace manager accessible', () => {
    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      workspaceDir: tmpDir,
      enableTelemetry: true,
    });
    const traceManager = runner.getTelemetry()!.getTraceManager();
    expect(traceManager).toBeDefined();
    expect(traceManager.getActiveSpans()).toEqual([]);
  });

  it('should create spans during executeTask', async () => {
    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      workspaceDir: tmpDir,
      enableTelemetry: true,
      enableLLM: true,
    });

    await runner.start();

    const traceManager = runner.getTelemetry()!.getTraceManager();

    // Submit a task and execute it
    const task = await runner.submitToTeam('planning', 'Test task', 'Test content');
    await runner.executeTask(task);

    // Should have completed spans
    const completedSpans = traceManager.getCompletedSpans();
    expect(completedSpans.length).toBeGreaterThanOrEqual(1);

    const taskSpan = completedSpans.find((s) => s.name === 'executeTask');
    expect(taskSpan).toBeDefined();
    expect(taskSpan!.attributes['task.id']).toBe(task.metadata.id);
    expect(taskSpan!.attributes['task.team']).toBe('planning');

    await runner.destroy();
  });

  it('should shut down telemetry on destroy', async () => {
    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      workspaceDir: tmpDir,
      enableTelemetry: true,
    });

    const telemetry = runner.getTelemetry()!;
    expect(telemetry.isEnabled()).toBe(true);

    await runner.start();
    await runner.destroy();

    // After destroy, completed spans should be cleared
    expect(telemetry.getTraceManager().getCompletedSpans()).toEqual([]);
  });
});

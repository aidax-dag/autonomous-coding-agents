/**
 * Seven-Phase Workflow Tests
 *
 * Tests for the 7-phase structured workflow engine:
 * Discovery -> Exploration -> Clarification -> Design -> Implementation -> Review -> Summary
 */

import {
  SevenPhaseWorkflow,
  createSevenPhaseWorkflow,
  DEFAULT_PHASE_DEFINITIONS,
  PhaseDefinition,
  PhaseExecutionResult,
  PhaseExecutor,
  PhaseExecutionContext,
  SevenPhaseType,
} from '../../../../../src/core/orchestrator/workflow';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock PhaseExecutor that returns successful results.
 */
function createMockExecutor(
  options?: {
    failOn?: SevenPhaseType[];
    outputs?: Partial<Record<SevenPhaseType, unknown>>;
    artifacts?: Partial<Record<SevenPhaseType, PhaseExecutionResult['artifacts']>>;
    decisions?: Partial<Record<SevenPhaseType, string[]>>;
    delay?: number;
  },
): { executor: PhaseExecutor; calls: Array<{ phase: PhaseDefinition; context: PhaseExecutionContext }> } {
  const calls: Array<{ phase: PhaseDefinition; context: PhaseExecutionContext }> = [];

  const executor: PhaseExecutor = async (phase, _previousResults, context) => {
    calls.push({ phase, context });

    if (options?.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    if (options?.failOn?.includes(phase.type)) {
      return {
        phaseType: phase.type,
        status: 'failed' as const,
        duration: 10,
        error: `Phase ${phase.name} failed intentionally`,
      };
    }

    return {
      phaseType: phase.type,
      status: 'completed' as const,
      output: options?.outputs?.[phase.type] ?? `Output from ${phase.name}`,
      artifacts: options?.artifacts?.[phase.type],
      decisions: options?.decisions?.[phase.type],
      duration: 10,
    };
  };

  return { executor, calls };
}

/**
 * All seven phase types in order.
 */
const ALL_PHASE_TYPES: SevenPhaseType[] = [
  'discovery',
  'exploration',
  'clarification',
  'design',
  'implementation',
  'review',
  'summary',
];

// ============================================================================
// Tests
// ============================================================================

describe('DEFAULT_PHASE_DEFINITIONS', () => {
  it('should have exactly 7 phases', () => {
    expect(DEFAULT_PHASE_DEFINITIONS).toHaveLength(7);
  });

  it('should contain all seven phase types in correct order', () => {
    const types = DEFAULT_PHASE_DEFINITIONS.map((p) => p.type);
    expect(types).toEqual(ALL_PHASE_TYPES);
  });

  it('should have sequential order values (0-6)', () => {
    const orders = DEFAULT_PHASE_DEFINITIONS.map((p) => p.order);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('should have unique phase types', () => {
    const types = DEFAULT_PHASE_DEFINITIONS.map((p) => p.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(7);
  });

  it('should have all required fields on each definition', () => {
    for (const phase of DEFAULT_PHASE_DEFINITIONS) {
      expect(phase.type).toBeDefined();
      expect(phase.name).toBeDefined();
      expect(phase.description).toBeDefined();
      expect(typeof phase.order).toBe('number');
      expect(typeof phase.required).toBe('boolean');
      expect(typeof phase.estimatedDurationMs).toBe('number');
      expect(phase.team).toBeDefined();
      expect(phase.taskType).toBeDefined();
    }
  });
});

describe('SevenPhaseWorkflow construction', () => {
  it('should create with default phases', () => {
    const workflow = new SevenPhaseWorkflow({ goal: 'Test goal' });
    const definitions = workflow.getPhaseDefinitions();
    expect(definitions).toHaveLength(7);
    expect(definitions[0].type).toBe('discovery');
    expect(definitions[6].type).toBe('summary');
  });

  it('should return null from getCurrentPhase() before execution', () => {
    const workflow = new SevenPhaseWorkflow({ goal: 'Test goal' });
    expect(workflow.getCurrentPhase()).toBeNull();
  });

  it('should return all 7 phases from getPhaseDefinitions()', () => {
    const workflow = new SevenPhaseWorkflow({ goal: 'Test goal' });
    const definitions = workflow.getPhaseDefinitions();
    expect(definitions).toHaveLength(7);

    const types = definitions.map((d) => d.type);
    expect(types).toEqual(ALL_PHASE_TYPES);
  });
});

describe('execute() - Happy path', () => {
  it('should execute all 7 phases in order', async () => {
    const { executor, calls } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    await workflow.execute(executor);

    expect(calls).toHaveLength(7);
    const executedTypes = calls.map((c) => c.phase.type);
    expect(executedTypes).toEqual(ALL_PHASE_TYPES);
  });

  it('should return SevenPhaseResult with success=true', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(true);
    expect(result.goal).toBe('Build feature');
    expect(result.error).toBeUndefined();
  });

  it('should report completedPhases=7, failedPhases=0', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.completedPhases).toBe(7);
    expect(result.failedPhases).toBe(0);
    expect(result.skippedPhases).toBe(0);
  });

  it('should calculate totalDuration correctly', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const before = Date.now();
    const result = await workflow.execute(executor);
    const after = Date.now();

    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    expect(result.totalDuration).toBeLessThanOrEqual(after - before + 10);
  });

  it('should capture each phase result with correct type', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.phases).toHaveLength(7);
    for (let i = 0; i < ALL_PHASE_TYPES.length; i++) {
      expect(result.phases[i].phaseType).toBe(ALL_PHASE_TYPES[i]);
      expect(result.phases[i].status).toBe('completed');
    }
  });
});

describe('execute() - Skip phases', () => {
  it('should skip phases listed in config.skipPhases', async () => {
    const { executor, calls } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      skipPhases: ['clarification'],
    });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(true);
    // Executor should NOT have been called for clarification
    const executedTypes = calls.map((c) => c.phase.type);
    expect(executedTypes).not.toContain('clarification');
    expect(calls).toHaveLength(6);
  });

  it('should mark skipped phases with status=skipped in results', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      skipPhases: ['clarification'],
    });

    const result = await workflow.execute(executor);

    const clarificationResult = result.phases.find((p) => p.phaseType === 'clarification');
    expect(clarificationResult).toBeDefined();
    expect(clarificationResult!.status).toBe('skipped');
    expect(result.skippedPhases).toBe(1);
    expect(result.completedPhases).toBe(6);
  });

  it('should handle skipping multiple phases', async () => {
    const { executor, calls } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      skipPhases: ['clarification', 'review'],
    });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(true);
    expect(result.skippedPhases).toBe(2);
    expect(result.completedPhases).toBe(5);
    expect(calls).toHaveLength(5);
  });
});

describe('execute() - Failure handling', () => {
  it('should stop on required phase failure', async () => {
    const { executor, calls } = createMockExecutor({ failOn: ['design'] });
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Design');
    // Should have executed discovery, exploration, clarification, design (4 phases)
    // and stopped after design failed
    expect(calls).toHaveLength(4);
  });

  it('should return success=false with error details on failure', async () => {
    const { executor } = createMockExecutor({ failOn: ['implementation'] });
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Implementation');
    expect(result.error).toContain('failed');
  });

  it('should continue when non-required phase fails', async () => {
    // clarification is required: false by default
    const { executor, calls } = createMockExecutor({ failOn: ['clarification'] });
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.success).toBe(true);
    expect(result.failedPhases).toBe(1);
    expect(result.completedPhases).toBe(6);
    expect(calls).toHaveLength(7);
  });

  it('should accurately count failedPhases', async () => {
    const { executor } = createMockExecutor({ failOn: ['clarification'] });
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    const result = await workflow.execute(executor);

    expect(result.failedPhases).toBe(1);
    const failedResult = result.phases.find((p) => p.phaseType === 'clarification');
    expect(failedResult?.status).toBe('failed');
  });
});

describe('execute() - Events', () => {
  it('should emit workflow:started at beginning', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    const events: string[] = [];

    workflow.on('workflow:started', (data) => {
      events.push(`workflow:started:${data.goal}`);
    });

    await workflow.execute(executor);

    expect(events).toContain('workflow:started:Build feature');
  });

  it('should emit phase:started and phase:completed for each phase', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    const events: string[] = [];

    workflow.on('phase:started', (data) => events.push(`started:${data.type}`));
    workflow.on('phase:completed', (result) => events.push(`completed:${result.phaseType}`));

    await workflow.execute(executor);

    for (const type of ALL_PHASE_TYPES) {
      expect(events).toContain(`started:${type}`);
      expect(events).toContain(`completed:${type}`);
    }
  });

  it('should emit phase:skipped for skipped phases', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      skipPhases: ['clarification'],
    });
    const skippedEvents: Array<{ type: SevenPhaseType; reason: string }> = [];

    workflow.on('phase:skipped', (data) => skippedEvents.push(data));

    await workflow.execute(executor);

    expect(skippedEvents).toHaveLength(1);
    expect(skippedEvents[0].type).toBe('clarification');
  });

  it('should emit workflow:completed or workflow:failed at end', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    let completedResult: unknown = null;

    workflow.on('workflow:completed', (result) => {
      completedResult = result;
    });

    await workflow.execute(executor);
    expect(completedResult).not.toBeNull();

    // Test failure case
    const { executor: failingExecutor } = createMockExecutor({ failOn: ['discovery'] });
    const failWorkflow = new SevenPhaseWorkflow({ goal: 'Fail' });
    let failedResult: unknown = null;

    failWorkflow.on('workflow:failed', (result) => {
      failedResult = result;
    });

    await failWorkflow.execute(failingExecutor);
    expect(failedResult).not.toBeNull();
  });
});

describe('execute() - Context passing', () => {
  it('should pass accumulated artifacts from previous phases', async () => {
    const artifact1 = { name: 'requirements.md', type: 'document' as const, content: 'Requirements' };
    const artifact2 = { name: 'design.md', type: 'document' as const, content: 'Design doc' };

    const { executor, calls } = createMockExecutor({
      artifacts: {
        discovery: [artifact1],
        design: [artifact2],
      },
    });

    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    await workflow.execute(executor);

    // Implementation phase (index 4) should have artifacts from discovery and design
    const implCall = calls.find((c) => c.phase.type === 'implementation');
    expect(implCall).toBeDefined();
    expect(implCall!.context.artifacts).toHaveLength(2);
    expect(implCall!.context.artifacts).toContainEqual(artifact1);
    expect(implCall!.context.artifacts).toContainEqual(artifact2);
  });

  it('should provide correct phaseIndex and totalPhases', async () => {
    const { executor, calls } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    await workflow.execute(executor);

    for (let i = 0; i < calls.length; i++) {
      expect(calls[i].context.phaseIndex).toBe(i);
      expect(calls[i].context.totalPhases).toBe(7);
    }
  });

  it('should pass goal through context', async () => {
    const { executor, calls } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Implement auth system' });

    await workflow.execute(executor);

    for (const call of calls) {
      expect(call.context.goal).toBe('Implement auth system');
    }
  });
});

describe('cancel()', () => {
  it('should cancel in-progress workflow', async () => {
    let phaseCount = 0;
    const executor: PhaseExecutor = async (phase) => {
      phaseCount++;
      if (phase.type === 'exploration') {
        // Cancel during exploration
        workflow.cancel();
      }
      return {
        phaseType: phase.type,
        status: 'completed' as const,
        duration: 5,
      };
    };

    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    const result = await workflow.execute(executor);

    // Exploration completes, then workflow checks cancelled flag before clarification
    expect(phaseCount).toBeLessThan(7);
    expect(result.success).toBe(false);
  });

  it('should not execute remaining phases after cancellation', async () => {
    const executedPhases: SevenPhaseType[] = [];
    const executor: PhaseExecutor = async (phase) => {
      executedPhases.push(phase.type);
      if (phase.type === 'design') {
        workflow.cancel();
      }
      return {
        phaseType: phase.type,
        status: 'completed' as const,
        duration: 5,
      };
    };

    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    await workflow.execute(executor);

    // Should have executed up to and including design, then stopped
    expect(executedPhases).toContain('discovery');
    expect(executedPhases).toContain('design');
    expect(executedPhases).not.toContain('implementation');
    expect(executedPhases).not.toContain('review');
    expect(executedPhases).not.toContain('summary');
  });
});

describe('getResults()', () => {
  it('should return empty array before execution', () => {
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    expect(workflow.getResults()).toEqual([]);
  });

  it('should return accumulated results after execution', async () => {
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    await workflow.execute(executor);

    const results = workflow.getResults();
    expect(results).toHaveLength(7);
    expect(results[0].phaseType).toBe('discovery');
    expect(results[6].phaseType).toBe('summary');
  });
});

describe('getPhaseResult()', () => {
  it('should return undefined for unexecuted phase', () => {
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    expect(workflow.getPhaseResult('discovery')).toBeUndefined();
  });

  it('should return correct result after phase completion', async () => {
    const { executor } = createMockExecutor({
      outputs: { discovery: 'Discovery output data' },
    });
    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });

    await workflow.execute(executor);

    const discoveryResult = workflow.getPhaseResult('discovery');
    expect(discoveryResult).toBeDefined();
    expect(discoveryResult!.phaseType).toBe('discovery');
    expect(discoveryResult!.status).toBe('completed');
    expect(discoveryResult!.output).toBe('Discovery output data');
  });
});

describe('onPhaseComplete callback', () => {
  it('should call onPhaseComplete after each phase completion', async () => {
    const completedPhases: SevenPhaseType[] = [];
    const { executor } = createMockExecutor();
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      onPhaseComplete: (result) => {
        completedPhases.push(result.phaseType);
      },
    });

    await workflow.execute(executor);

    expect(completedPhases).toEqual(ALL_PHASE_TYPES);
  });

  it('should receive PhaseExecutionResult in callback', async () => {
    const results: PhaseExecutionResult[] = [];
    const { executor } = createMockExecutor({
      outputs: { discovery: 'Found requirements' },
    });
    const workflow = new SevenPhaseWorkflow({
      goal: 'Build feature',
      onPhaseComplete: (result) => {
        results.push(result);
      },
    });

    await workflow.execute(executor);

    expect(results).toHaveLength(7);
    expect(results[0].phaseType).toBe('discovery');
    expect(results[0].status).toBe('completed');
    expect(results[0].output).toBe('Found requirements');
  });
});

describe('createSevenPhaseWorkflow factory', () => {
  it('should create a SevenPhaseWorkflow instance', async () => {
    const workflow = createSevenPhaseWorkflow({ goal: 'Test factory' });

    expect(workflow).toBeInstanceOf(SevenPhaseWorkflow);
    expect(workflow.getPhaseDefinitions()).toHaveLength(7);

    const { executor } = createMockExecutor();
    const result = await workflow.execute(executor);
    expect(result.success).toBe(true);
  });
});

describe('execute() - Exception handling in executor', () => {
  it('should handle exceptions thrown by the executor', async () => {
    const executor: PhaseExecutor = async (phase) => {
      if (phase.type === 'design') {
        throw new Error('Unexpected executor error');
      }
      return {
        phaseType: phase.type,
        status: 'completed' as const,
        duration: 5,
      };
    };

    const workflow = new SevenPhaseWorkflow({ goal: 'Build feature' });
    const result = await workflow.execute(executor);

    // design is required, so workflow should fail
    expect(result.success).toBe(false);
    expect(result.error).toContain('Design');

    const designResult = result.phases.find((p) => p.phaseType === 'design');
    expect(designResult?.status).toBe('failed');
    expect(designResult?.error).toBe('Unexpected executor error');
  });
});

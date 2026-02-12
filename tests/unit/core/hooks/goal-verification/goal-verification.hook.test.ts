/**
 * GoalVerificationHook Unit Tests
 */

import { GoalVerificationHook } from '../../../../../src/core/hooks/goal-verification/goal-verification.hook';
import { HookEvent, HookAction } from '../../../../../src/core/interfaces/hook.interface';
import type { GoalBackwardVerifier } from '../../../../../src/core/validation/goal-backward-verifier';
import type { GoalBackwardResult } from '../../../../../src/core/validation/interfaces/validation.interface';

function createMockVerifier(result: GoalBackwardResult): GoalBackwardVerifier {
  return {
    verify: jest.fn().mockResolvedValue(result),
  } as unknown as GoalBackwardVerifier;
}

function makeContext(goalDescription: string, expectedPaths: string[]) {
  return {
    event: HookEvent.WORKFLOW_END,
    timestamp: new Date(),
    source: 'test',
    data: { goalDescription, expectedPaths },
  };
}

describe('GoalVerificationHook', () => {
  it('should have correct name and event', () => {
    const verifier = createMockVerifier({ passed: true, stages: [] } as unknown as GoalBackwardResult);
    const hook = new GoalVerificationHook(verifier);
    expect(hook.name).toBe('goal-verification');
    expect(hook.event).toBe(HookEvent.WORKFLOW_END);
  });

  it('should continue with undefined when no expected paths', async () => {
    const verifier = createMockVerifier({ passed: true, stages: [] } as unknown as GoalBackwardResult);
    const hook = new GoalVerificationHook(verifier);
    const result = await hook.execute(makeContext('some goal', []));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('No expected paths');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('should continue with result when verification passes', async () => {
    const backwardResult: GoalBackwardResult = {
      passed: true,
      stages: [
        { stage: 'EXISTS', passed: true, details: [] },
        { stage: 'SUBSTANTIVE', passed: true, details: [] },
        { stage: 'WIRED', passed: true, details: [] },
      ],
    } as unknown as GoalBackwardResult;

    const verifier = createMockVerifier(backwardResult);
    const hook = new GoalVerificationHook(verifier);
    const result = await hook.execute(makeContext('add auth', ['src/auth.ts']));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('passed');
    expect(result.data).toBe(backwardResult);
  });

  it('should continue with failure message when verification fails', async () => {
    const backwardResult: GoalBackwardResult = {
      passed: false,
      stages: [
        { stage: 'EXISTS', passed: true, details: [] },
        { stage: 'SUBSTANTIVE', passed: false, details: [] },
        { stage: 'WIRED', passed: false, details: [] },
      ],
    } as unknown as GoalBackwardResult;

    const verifier = createMockVerifier(backwardResult);
    const hook = new GoalVerificationHook(verifier);
    const result = await hook.execute(makeContext('add auth', ['src/auth.ts']));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('failed');
    expect(result.message).toContain('SUBSTANTIVE');
    expect(result.message).toContain('WIRED');
  });

  it('should continue gracefully when verifier throws', async () => {
    const verifier = {
      verify: jest.fn().mockRejectedValue(new Error('verifier error')),
    } as unknown as GoalBackwardVerifier;

    const hook = new GoalVerificationHook(verifier);
    const result = await hook.execute(makeContext('goal', ['src/foo.ts']));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('skipped due to error');
  });

  it('should use priority 50 by default', () => {
    const verifier = createMockVerifier({ passed: true, stages: [] } as unknown as GoalBackwardResult);
    const hook = new GoalVerificationHook(verifier);
    expect(hook.getConfig().priority).toBe(50);
  });

  it('should allow priority override', () => {
    const verifier = createMockVerifier({ passed: true, stages: [] } as unknown as GoalBackwardResult);
    const hook = new GoalVerificationHook(verifier, { priority: 10 });
    expect(hook.getConfig().priority).toBe(10);
  });
});

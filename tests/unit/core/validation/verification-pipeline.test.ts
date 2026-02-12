/**
 * Verification Pipeline Tests
 */

import { VerificationPipeline } from '@/core/validation/verification-pipeline';
import { StubDetector } from '@/core/validation/stub-detector';
import type { IGoalBackwardVerifier, GoalDefinition, GoalBackwardResult } from '@/core/validation/interfaces/validation.interface';
import { VerificationStage } from '@/core/validation/interfaces/validation.interface';

const mockVerifier: IGoalBackwardVerifier = {
  verifyExists: jest.fn().mockResolvedValue(true),
  verifySubstantive: jest.fn().mockResolvedValue(true),
  verifyWired: jest.fn().mockResolvedValue(true),
  verify: jest.fn().mockResolvedValue({
    passed: true,
    stages: [
      { stage: VerificationStage.EXISTS, passed: true, details: 'OK', checkedPaths: [] },
      { stage: VerificationStage.SUBSTANTIVE, passed: true, details: 'OK', checkedPaths: [] },
      { stage: VerificationStage.WIRED, passed: true, details: 'OK', checkedPaths: [] },
    ],
  } satisfies GoalBackwardResult),
};

describe('VerificationPipeline', () => {
  it('should wrap existing verifier', async () => {
    const pipeline = new VerificationPipeline(mockVerifier);
    const goal: GoalDefinition = {
      description: 'Test goal',
      expectedPaths: [],
    };
    const report = await pipeline.verify(goal);
    expect(report).toBeDefined();
    expect(report.stages).toHaveLength(3);
    expect(mockVerifier.verify).toHaveBeenCalledWith(goal);
  });

  it('should produce structured report', async () => {
    const pipeline = new VerificationPipeline(mockVerifier);
    const report = await pipeline.verify({
      description: 'Test',
      expectedPaths: [],
    });
    expect(report.passed).toBe(true);
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.duration).toBeGreaterThanOrEqual(0);
    expect(typeof report.summary).toBe('string');
  });

  it('should execute pre-hooks', async () => {
    const pipeline = new VerificationPipeline(mockVerifier);
    const preHook = jest.fn();
    pipeline.addPreHook(preHook);

    await pipeline.verify({ description: 'Test', expectedPaths: [] });
    expect(preHook).toHaveBeenCalledTimes(1);
  });

  it('should execute post-hooks', async () => {
    const pipeline = new VerificationPipeline(mockVerifier);
    const postHook = jest.fn();
    pipeline.addPostHook(postHook);

    await pipeline.verify({ description: 'Test', expectedPaths: [] });
    expect(postHook).toHaveBeenCalledTimes(1);
  });

  it('should handle non-existent files', async () => {
    const pipeline = new VerificationPipeline(mockVerifier);
    const report = await pipeline.verify({
      description: 'Test',
      expectedPaths: ['/nonexistent/path.ts'],
    });
    expect(report.files).toHaveLength(1);
    expect(report.files[0].exists).toBe(false);
    expect(report.files[0].issues).toContain('File not found');
  });

  it('should detect failing stages from verifier', async () => {
    const failVerifier: IGoalBackwardVerifier = {
      ...mockVerifier,
      verify: jest.fn().mockResolvedValue({
        passed: false,
        stages: [
          { stage: VerificationStage.EXISTS, passed: true, details: 'OK' },
          { stage: VerificationStage.SUBSTANTIVE, passed: false, details: 'Stubs found' },
          { stage: VerificationStage.WIRED, passed: false, details: 'Not connected' },
        ],
      }),
    };
    const pipeline = new VerificationPipeline(failVerifier);
    const report = await pipeline.verify({
      description: 'Test',
      expectedPaths: [],
    });
    expect(report.passed).toBe(false);
  });

  it('should use custom stub detector', async () => {
    const customDetector = new StubDetector([
      { pattern: /CUSTOM/, description: 'Custom', severity: 'error' },
    ]);
    const pipeline = new VerificationPipeline(mockVerifier, customDetector);
    expect(pipeline).toBeDefined();
  });
});

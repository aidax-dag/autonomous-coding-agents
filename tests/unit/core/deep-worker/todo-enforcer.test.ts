/**
 * TodoContinuationEnforcer Tests
 */

import { TodoContinuationEnforcer, createTodoContinuationEnforcer } from '../../../../src/core/deep-worker/todo-enforcer';
import type { PlannedStep } from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

function createSteps(): PlannedStep[] {
  return [
    { id: 'explore', description: 'Explore', type: 'explore', dependencies: [], effort: 'small', completed: false },
    { id: 'implement', description: 'Implement', type: 'implement', dependencies: ['explore'], effort: 'medium', completed: false },
    { id: 'test', description: 'Test', type: 'test', dependencies: ['implement'], effort: 'small', completed: false },
  ];
}

describe('TodoContinuationEnforcer', () => {
  let enforcer: TodoContinuationEnforcer;

  beforeEach(() => {
    enforcer = new TodoContinuationEnforcer();
  });

  it('should track steps', () => {
    enforcer.trackSteps(createSteps());
    const status = enforcer.getStatus();

    expect(status.totalSteps).toBe(3);
    expect(status.completedSteps).toBe(0);
    expect(status.remainingSteps).toBe(3);
    expect(status.allComplete).toBe(false);
  });

  it('should complete steps', () => {
    enforcer.trackSteps(createSteps());
    enforcer.completeStep('explore');

    const status = enforcer.getStatus();
    expect(status.completedSteps).toBe(1);
    expect(status.remainingSteps).toBe(2);
  });

  it('should fail steps', () => {
    enforcer.trackSteps(createSteps());
    enforcer.failStep('explore', 'timeout');

    const status = enforcer.getStatus();
    expect(status.failedSteps).toBe(1);
    expect(status.completedSteps).toBe(0);
  });

  it('should report allComplete when all done', () => {
    enforcer.trackSteps(createSteps());
    enforcer.completeStep('explore');
    enforcer.completeStep('implement');
    enforcer.completeStep('test');

    expect(enforcer.getStatus().allComplete).toBe(true);
    expect(enforcer.getStatus().incompleteStepIds).toEqual([]);
  });

  it('should return incomplete step IDs', () => {
    enforcer.trackSteps(createSteps());
    enforcer.completeStep('explore');

    expect(enforcer.getStatus().incompleteStepIds).toEqual(['implement', 'test']);
  });

  it('should return next step respecting dependencies', () => {
    enforcer.trackSteps(createSteps());

    // Only 'explore' has no dependencies
    const first = enforcer.getNextStep();
    expect(first!.id).toBe('explore');

    // After completing explore, implement becomes available
    enforcer.completeStep('explore');
    const second = enforcer.getNextStep();
    expect(second!.id).toBe('implement');

    // Test is still blocked by implement
    expect(second!.id).not.toBe('test');
  });

  it('should return null when upstream step has failed', () => {
    enforcer.trackSteps(createSteps());

    // Fail explore — implement and test are blocked by upstream failure
    enforcer.failStep('explore', 'failed');

    // explore has error, implement/test depend on explore → all blocked
    const next = enforcer.getNextStep();
    expect(next).toBeNull();
  });

  it('should return null when all steps are complete', () => {
    enforcer.trackSteps(createSteps());
    enforcer.completeStep('explore');
    enforcer.completeStep('implement');
    enforcer.completeStep('test');

    expect(enforcer.getNextStep()).toBeNull();
  });

  it('should handle parallel steps (no dependencies)', () => {
    enforcer.trackSteps([
      { id: 'a', description: 'A', type: 'implement', dependencies: [], effort: 'small', completed: false },
      { id: 'b', description: 'B', type: 'implement', dependencies: [], effort: 'small', completed: false },
    ]);

    // Both are available, should return first
    expect(enforcer.getNextStep()!.id).toBe('a');

    enforcer.completeStep('a');
    expect(enforcer.getNextStep()!.id).toBe('b');
  });

  it('should reset tracking', () => {
    enforcer.trackSteps(createSteps());
    enforcer.completeStep('explore');

    enforcer.reset();

    expect(enforcer.getStatus().totalSteps).toBe(0);
    expect(enforcer.getNextStep()).toBeNull();
  });

  it('should be created via factory', () => {
    expect(createTodoContinuationEnforcer()).toBeInstanceOf(TodoContinuationEnforcer);
  });
});

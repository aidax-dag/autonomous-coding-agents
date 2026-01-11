/**
 * Progress Tracker Tests
 */

import {
  ProgressTracker,
  createProgressTracker,
  ProgressTrackerEvents,
  type ProgressTrackerConfig,
  type ProgressReportFormat,
} from '../../../../src/core/workflow/progress-tracker.js';
import { WorkflowStatus, StepStatus } from '../../../../src/core/workflow/workflow-definition.js';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  const instanceId = 'test-instance-1';
  const workflowId = 'test-workflow';
  const workflowName = 'Test Workflow';
  const totalSteps = 5;

  const defaultConfig: ProgressTrackerConfig = {
    instanceId,
    workflowId,
    workflowName,
    totalSteps,
  };

  beforeEach(() => {
    tracker = new ProgressTracker(defaultConfig);
  });

  describe('constructor', () => {
    it('should create instance with correct initial state', () => {
      expect(tracker.instanceId).toBe(instanceId);
      expect(tracker.progress.workflowId).toBe(workflowId);
      expect(tracker.progress.workflowName).toBe(workflowName);
      expect(tracker.progress.totalSteps).toBe(totalSteps);
      expect(tracker.progress.status).toBe(WorkflowStatus.PENDING);
      expect(tracker.progress.completedSteps).toBe(0);
      expect(tracker.progress.failedSteps).toBe(0);
      expect(tracker.progress.progressPercentage).toBe(0);
    });

    it('should initialize with custom config', () => {
      const config: ProgressTrackerConfig = {
        instanceId,
        workflowId,
        workflowName,
        totalSteps,
        enableHistory: false,
        maxHistorySize: 50,
      };
      const customTracker = new ProgressTracker(config);
      expect(customTracker.progress.totalSteps).toBe(totalSteps);
    });

    it('should handle zero total steps', () => {
      const zeroStepTracker = new ProgressTracker({
        ...defaultConfig,
        totalSteps: 0,
      });
      expect(zeroStepTracker.progress.totalSteps).toBe(0);
      expect(zeroStepTracker.progress.progressPercentage).toBe(0);
    });

    it('should initialize with step names', () => {
      const stepNames = new Map([
        ['step-1', 'First Step'],
        ['step-2', 'Second Step'],
      ]);
      const trackerWithNames = new ProgressTracker({
        ...defaultConfig,
        stepNames,
      });
      trackerWithNames.startWorkflow();
      trackerWithNames.startStep('step-1');
      expect(trackerWithNames.getStepProgress('step-1')?.name).toBe('First Step');
    });

    it('should initialize with milestones', () => {
      const milestones = new Map([
        [25, '25% complete'],
        [50, 'Halfway done'],
        [100, 'All done'],
      ]);
      const trackerWithMilestones = new ProgressTracker({
        ...defaultConfig,
        milestones,
      });
      expect(trackerWithMilestones).toBeInstanceOf(ProgressTracker);
    });
  });

  describe('createProgressTracker factory', () => {
    it('should create tracker using factory function', () => {
      const factoryTracker = createProgressTracker(
        instanceId,
        workflowId,
        workflowName,
        totalSteps
      );
      expect(factoryTracker).toBeInstanceOf(ProgressTracker);
      expect(factoryTracker.instanceId).toBe(instanceId);
    });

    it('should create tracker with custom options', () => {
      const factoryTracker = createProgressTracker(
        instanceId,
        workflowId,
        workflowName,
        totalSteps,
        { enableHistory: false }
      );
      expect(factoryTracker).toBeInstanceOf(ProgressTracker);
    });
  });

  describe('workflow lifecycle', () => {
    describe('startWorkflow', () => {
      it('should start workflow and update status', () => {
        tracker.startWorkflow();
        expect(tracker.progress.status).toBe(WorkflowStatus.RUNNING);
        expect(tracker.progress.startedAt).toBeDefined();
      });

      it('should emit started event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.WORKFLOW_STARTED, handler);
        tracker.startWorkflow();
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('completeWorkflow', () => {
      it('should complete workflow', () => {
        tracker.startWorkflow();
        tracker.completeWorkflow();
        expect(tracker.progress.status).toBe(WorkflowStatus.COMPLETED);
        expect(tracker.progress.completedAt).toBeDefined();
        expect(tracker.progress.progressPercentage).toBe(100);
      });

      it('should emit completed event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.WORKFLOW_COMPLETED, handler);
        tracker.startWorkflow();
        tracker.completeWorkflow();
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('failWorkflow', () => {
      it('should fail workflow with error', () => {
        tracker.startWorkflow();
        tracker.failWorkflow('Critical error');
        expect(tracker.progress.status).toBe(WorkflowStatus.FAILED);
        expect(tracker.progress.errors.length).toBeGreaterThan(0);
        expect(tracker.progress.errors[0].error).toBe('Critical error');
      });

      it('should emit failed event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.WORKFLOW_FAILED, handler);
        tracker.startWorkflow();
        tracker.failWorkflow('Error');
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('pauseWorkflow', () => {
      it('should pause running workflow', () => {
        tracker.startWorkflow();
        tracker.pauseWorkflow();
        expect(tracker.progress.status).toBe(WorkflowStatus.PAUSED);
      });

      it('should record pause in history', () => {
        tracker.startWorkflow();
        const historyLengthBefore = tracker.history.length;
        tracker.pauseWorkflow();
        expect(tracker.history.length).toBeGreaterThan(historyLengthBefore);
      });
    });

    describe('resumeWorkflow', () => {
      it('should resume paused workflow', () => {
        tracker.startWorkflow();
        tracker.pauseWorkflow();
        tracker.resumeWorkflow();
        expect(tracker.progress.status).toBe(WorkflowStatus.RUNNING);
      });

      it('should record resume in history', () => {
        tracker.startWorkflow();
        tracker.pauseWorkflow();
        const historyLengthBefore = tracker.history.length;
        tracker.resumeWorkflow();
        expect(tracker.history.length).toBeGreaterThan(historyLengthBefore);
      });
    });

    describe('cancelWorkflow', () => {
      it('should cancel workflow', () => {
        tracker.startWorkflow();
        tracker.cancelWorkflow();
        expect(tracker.progress.status).toBe(WorkflowStatus.CANCELLED);
        expect(tracker.progress.completedAt).toBeDefined();
      });

      it('should record cancel in history', () => {
        tracker.startWorkflow();
        const historyLengthBefore = tracker.history.length;
        tracker.cancelWorkflow();
        expect(tracker.history.length).toBeGreaterThan(historyLengthBefore);
      });
    });
  });

  describe('step lifecycle', () => {
    beforeEach(() => {
      tracker.startWorkflow();
    });

    describe('startStep', () => {
      it('should start step and create progress entry', () => {
        tracker.startStep('step-1', { name: 'Test Step' });
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress).toBeDefined();
        expect(stepProgress?.status).toBe(StepStatus.RUNNING);
        expect(stepProgress?.startedAt).toBeDefined();
      });

      it('should update current step', () => {
        tracker.startStep('step-1');
        expect(tracker.progress.currentStep).toBe('step-1');
        expect(tracker.progress.runningSteps).toBe(1);
      });

      it('should emit step started event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.STEP_STARTED, handler);
        tracker.startStep('step-1');
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should store step metadata', () => {
        tracker.startStep('step-1', { customField: 'value' });
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.metadata?.customField).toBe('value');
      });
    });

    describe('completeStep', () => {
      it('should complete step', () => {
        tracker.startStep('step-1');
        tracker.completeStep('step-1');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.status).toBe(StepStatus.COMPLETED);
        expect(stepProgress?.completedAt).toBeDefined();
        expect(stepProgress?.duration).toBeDefined();
      });

      it('should update progress counters', () => {
        tracker.startStep('step-1');
        tracker.completeStep('step-1');
        expect(tracker.progress.completedSteps).toBe(1);
        expect(tracker.progress.runningSteps).toBe(0);
        expect(tracker.progress.progressPercentage).toBe(20); // 1/5 = 20%
      });

      it('should emit step completed event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.STEP_COMPLETED, handler);
        tracker.startStep('step-1');
        tracker.completeStep('step-1');
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should throw for unknown step', () => {
        expect(() => tracker.completeStep('unknown')).toThrow("Step 'unknown' not found");
      });

      it('should merge metadata on completion', () => {
        tracker.startStep('step-1', { initial: true });
        tracker.completeStep('step-1', { result: 'success' });
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.metadata?.initial).toBe(true);
        expect(stepProgress?.metadata?.result).toBe('success');
      });
    });

    describe('failStep', () => {
      it('should fail step with error', () => {
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Step error');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.status).toBe(StepStatus.FAILED);
        expect(stepProgress?.error).toBe('Step error');
      });

      it('should update failed counter', () => {
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Error');
        expect(tracker.progress.failedSteps).toBe(1);
        expect(tracker.progress.errors.length).toBe(1);
      });

      it('should emit step failed event', () => {
        const handler = jest.fn();
        tracker.on(ProgressTrackerEvents.STEP_FAILED, handler);
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Error');
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should mark error as retryable when specified', () => {
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Retry error', true);
        const error = tracker.progress.errors[0];
        expect(error.retryable).toBe(true);
      });

      it('should throw for unknown step', () => {
        expect(() => tracker.failStep('unknown', 'Error')).toThrow("Step 'unknown' not found");
      });
    });

    describe('skipStep', () => {
      it('should skip step', () => {
        tracker.skipStep('step-1', 'Condition not met');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.status).toBe(StepStatus.SKIPPED);
      });

      it('should update skipped counter', () => {
        tracker.skipStep('step-1');
        expect(tracker.progress.skippedSteps).toBe(1);
      });

      it('should record skip reason in metadata', () => {
        tracker.skipStep('step-1', 'Condition not met');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.metadata?.skipReason).toBe('Condition not met');
      });
    });

    describe('retryStep', () => {
      it('should retry step and increment retry count', () => {
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Error', true);
        tracker.retryStep('step-1');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.status).toBe(StepStatus.RUNNING);
        expect(stepProgress?.retryCount).toBe(1);
      });

      it('should clear error on retry', () => {
        tracker.startStep('step-1');
        tracker.failStep('step-1', 'Error', true);
        tracker.retryStep('step-1');
        const stepProgress = tracker.getStepProgress('step-1');
        expect(stepProgress?.error).toBeUndefined();
      });

      it('should throw for unknown step', () => {
        expect(() => tracker.retryStep('unknown')).toThrow("Step 'unknown' not found");
      });
    });
  });

  describe('progress calculation', () => {
    beforeEach(() => {
      tracker.startWorkflow();
    });

    it('should calculate correct percentage', () => {
      tracker.startStep('step-1');
      tracker.completeStep('step-1');
      expect(tracker.progress.progressPercentage).toBe(20);

      tracker.startStep('step-2');
      tracker.completeStep('step-2');
      expect(tracker.progress.progressPercentage).toBe(40);

      tracker.startStep('step-3');
      tracker.completeStep('step-3');
      tracker.startStep('step-4');
      tracker.completeStep('step-4');
      tracker.startStep('step-5');
      tracker.completeStep('step-5');
      expect(tracker.progress.progressPercentage).toBe(100);
    });

    it('should include skipped steps in progress', () => {
      tracker.startStep('step-1');
      tracker.completeStep('step-1');
      tracker.skipStep('step-2');
      // 2 steps done (1 completed + 1 skipped) out of 5
      expect(tracker.progress.progressPercentage).toBe(40);
    });

    it('should include failed steps in progress', () => {
      tracker.startStep('step-1');
      tracker.completeStep('step-1');
      tracker.startStep('step-2');
      tracker.failStep('step-2', 'Error');
      // 2 steps done (1 completed + 1 failed) out of 5
      expect(tracker.progress.progressPercentage).toBe(40);
    });

    it('should handle zero total steps', () => {
      const zeroTracker = new ProgressTracker({ ...defaultConfig, totalSteps: 0 });
      zeroTracker.startWorkflow();
      expect(zeroTracker.progress.progressPercentage).toBe(0);
    });
  });

  describe('time estimation', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(defaultConfig);
      tracker.startWorkflow();
    });

    it('should return undefined before any steps complete', () => {
      const estimation = tracker.getEstimation();
      expect(estimation).toBeUndefined();
    });

    it('should calculate estimation after steps complete', async () => {
      tracker.startStep('step-1');
      await new Promise((r) => setTimeout(r, 50));
      tracker.completeStep('step-1');

      const estimation = tracker.getEstimation();
      expect(estimation).toBeDefined();
      expect(estimation?.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
      expect(estimation?.estimatedCompletionTime).toBeInstanceOf(Date);
      expect(estimation?.confidence).toBeGreaterThanOrEqual(0);
      expect(estimation?.basedOnSteps).toBe(1);
    });

    it('should update estimation with more data', async () => {
      tracker.startStep('step-1');
      await new Promise((r) => setTimeout(r, 30));
      tracker.completeStep('step-1');

      tracker.startStep('step-2');
      await new Promise((r) => setTimeout(r, 30));
      tracker.completeStep('step-2');

      const estimation = tracker.getEstimation();
      expect(estimation?.basedOnSteps).toBe(2);
    });
  });

  describe('report generation', () => {
    beforeEach(() => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');
      tracker.startStep('step-2');
    });

    describe('text format', () => {
      it('should generate text report', () => {
        const report = tracker.generateReport({ format: 'text' as ProgressReportFormat });
        expect(report.format).toBe('text');
        expect(report.content).toContain('Workflow Progress Report');
        expect(report.content).toContain('Test Workflow');
      });

      it('should include step details when requested', () => {
        const report = tracker.generateReport({
          format: 'text' as ProgressReportFormat,
          includeSteps: true,
        });
        expect(report.content).toContain('Steps');
      });
    });

    describe('JSON format', () => {
      it('should generate valid JSON report', () => {
        const report = tracker.generateReport({ format: 'json' as ProgressReportFormat });
        expect(report.format).toBe('json');
        const parsed = JSON.parse(report.content);
        expect(parsed.workflow.id).toBe(workflowId);
        expect(parsed.workflow.status).toBe(WorkflowStatus.RUNNING);
      });

      it('should include progress data', () => {
        const report = tracker.generateReport({ format: 'json' as ProgressReportFormat });
        const parsed = JSON.parse(report.content);
        expect(parsed.progress.percentage).toBe(20);
        expect(parsed.progress.completed).toBe(1);
      });
    });

    describe('Markdown format', () => {
      it('should generate markdown report', () => {
        const report = tracker.generateReport({ format: 'markdown' as ProgressReportFormat });
        expect(report.format).toBe('markdown');
        expect(report.content).toContain('# Workflow Progress Report');
        expect(report.content).toContain('**Workflow:**');
      });

      it('should use markdown formatting', () => {
        const report = tracker.generateReport({ format: 'markdown' as ProgressReportFormat });
        expect(report.content).toMatch(/^#/m); // Has headers
        expect(report.content).toContain('**'); // Has bold text
      });
    });

    describe('HTML format', () => {
      it('should generate HTML report', () => {
        const report = tracker.generateReport({ format: 'html' as ProgressReportFormat });
        expect(report.format).toBe('html');
        expect(report.content).toContain('<!DOCTYPE html>');
        expect(report.content).toContain('<html>');
      });

      it('should include styled progress bar', () => {
        const report = tracker.generateReport({ format: 'html' as ProgressReportFormat });
        expect(report.content).toContain('progress');
        expect(report.content).toContain('20%');
      });
    });

    describe('report options', () => {
      it('should respect includeEstimates option', () => {
        const report = tracker.generateReport({
          format: 'text' as ProgressReportFormat,
          includeEstimates: true,
        });
        // Report generated (estimation may or may not be available)
        expect(report.content).toBeDefined();
      });

      it('should respect includeErrors option', () => {
        tracker.failStep('step-2', 'Test error');
        const report = tracker.generateReport({
          format: 'text' as ProgressReportFormat,
          includeErrors: true,
        });
        expect(report.content).toContain('Test error');
      });

      it('should respect includeSteps option', () => {
        const report = tracker.generateReport({
          format: 'json' as ProgressReportFormat,
          includeSteps: true,
        });
        const parsed = JSON.parse(report.content);
        expect(parsed.steps).toBeDefined();
      });

      it('should respect verbose option', () => {
        const report = tracker.generateReport({
          format: 'text' as ProgressReportFormat,
          verbose: true,
          includeSteps: true,
        });
        expect(report.content).toBeDefined();
      });
    });

    describe('report metadata', () => {
      it('should include generation timestamp', () => {
        const report = tracker.generateReport();
        expect(report.generatedAt).toBeInstanceOf(Date);
      });

      it('should include instance ID', () => {
        const report = tracker.generateReport();
        expect(report.instanceId).toBe(instanceId);
      });
    });
  });

  describe('event handling', () => {
    it('should handle progress update events', () => {
      const handler = jest.fn();
      tracker.on(ProgressTrackerEvents.PROGRESS_UPDATED, handler);

      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');

      expect(handler).toHaveBeenCalled();
    });

    it('should support off() to remove listeners', () => {
      const handler = jest.fn();
      tracker.on(ProgressTrackerEvents.WORKFLOW_STARTED, handler);
      tracker.off(ProgressTrackerEvents.WORKFLOW_STARTED, handler);
      tracker.startWorkflow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit milestone events when enabled', () => {
      const milestones = new Map([
        [25, '25% complete'],
        [50, 'Halfway done'],
        [100, 'All done'],
      ]);
      const milestoneTracker = new ProgressTracker({
        instanceId,
        workflowId,
        workflowName,
        totalSteps: 4,
        milestones,
      });

      const handler = jest.fn();
      milestoneTracker.on(ProgressTrackerEvents.MILESTONE_REACHED, handler);

      milestoneTracker.startWorkflow();
      milestoneTracker.startStep('step-1');
      milestoneTracker.completeStep('step-1'); // 25%

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          milestone: '25% complete',
        })
      );
    });

    it('should emit estimation updated events', async () => {
      const handler = jest.fn();
      tracker.on(ProgressTrackerEvents.ESTIMATION_UPDATED, handler);

      tracker.startWorkflow();
      tracker.startStep('step-1');
      await new Promise((r) => setTimeout(r, 20));
      tracker.completeStep('step-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('snapshot and restore', () => {
    it('should create snapshot', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');

      const snapshot = tracker.snapshot();
      expect(snapshot.instanceId).toBe(instanceId);
      expect(snapshot.progress.completedSteps).toBe(1);
      expect(snapshot.history.length).toBeGreaterThan(0);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
    });

    it('should restore from snapshot', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');
      tracker.startStep('step-2');

      const snapshot = tracker.snapshot();

      // Create new tracker and restore
      const restoredTracker = new ProgressTracker(defaultConfig);
      restoredTracker.restore(snapshot);

      expect(restoredTracker.progress.status).toBe(WorkflowStatus.RUNNING);
      expect(restoredTracker.progress.completedSteps).toBe(1);
      expect(restoredTracker.getStepProgress('step-1')?.status).toBe(StepStatus.COMPLETED);
    });

    it('should preserve history on restore', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');

      const snapshot = tracker.snapshot();
      const restoredTracker = new ProgressTracker(defaultConfig);
      restoredTracker.restore(snapshot);

      expect(restoredTracker.history.length).toBe(snapshot.history.length);
    });

    it('should throw on instance ID mismatch', () => {
      tracker.startWorkflow();
      const snapshot = tracker.snapshot();

      const differentTracker = new ProgressTracker({
        ...defaultConfig,
        instanceId: 'different-instance',
      });

      expect(() => differentTracker.restore(snapshot)).toThrow('Snapshot instance ID mismatch');
    });

    it('should serialize and deserialize dates correctly', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');

      const snapshot = tracker.snapshot();
      const restoredTracker = new ProgressTracker(defaultConfig);
      restoredTracker.restore(snapshot);

      expect(restoredTracker.progress.startedAt).toBeInstanceOf(Date);
      const step = restoredTracker.getStepProgress('step-1');
      expect(step?.startedAt).toBeInstanceOf(Date);
      expect(step?.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('history management', () => {
    it('should track progress history', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.completeStep('step-1');

      expect(tracker.history.length).toBeGreaterThan(0);
    });

    it('should respect history limit', () => {
      const limitedTracker = new ProgressTracker({
        ...defaultConfig,
        totalSteps: 20,
        maxHistorySize: 5,
      });

      limitedTracker.startWorkflow();
      for (let i = 0; i < 10; i++) {
        limitedTracker.startStep(`step-${i}`);
        limitedTracker.completeStep(`step-${i}`);
      }

      expect(limitedTracker.history.length).toBeLessThanOrEqual(5);
    });

    it('should include timestamps in history', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');

      const entry = tracker.history[tracker.history.length - 1];
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should not record history when disabled', () => {
      const noHistoryTracker = new ProgressTracker({
        ...defaultConfig,
        enableHistory: false,
      });

      noHistoryTracker.startWorkflow();
      noHistoryTracker.startStep('step-1');
      noHistoryTracker.completeStep('step-1');

      expect(noHistoryTracker.history.length).toBe(0);
    });
  });

  describe('getProgress', () => {
    it('should return current progress state', () => {
      tracker.startWorkflow();
      const progress = tracker.getProgress();
      expect(progress.status).toBe(WorkflowStatus.RUNNING);
      expect(progress.instanceId).toBe(instanceId);
    });

    it('should return copy of progress state', () => {
      const progress1 = tracker.getProgress();
      tracker.startWorkflow();
      const progress2 = tracker.getProgress();

      expect(progress1.status).toBe(WorkflowStatus.PENDING);
      expect(progress2.status).toBe(WorkflowStatus.RUNNING);
    });
  });

  describe('getStepProgress', () => {
    it('should return step progress by id', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');

      const stepProgress = tracker.getStepProgress('step-1');
      expect(stepProgress).toBeDefined();
      expect(stepProgress?.stepId).toBe('step-1');
    });

    it('should return undefined for unknown step', () => {
      tracker.startWorkflow();
      const stepProgress = tracker.getStepProgress('unknown');
      expect(stepProgress).toBeUndefined();
    });

    it('should return copy of step progress', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');

      const step1 = tracker.getStepProgress('step-1');
      tracker.completeStep('step-1');
      const step2 = tracker.getStepProgress('step-1');

      expect(step1?.status).toBe(StepStatus.RUNNING);
      expect(step2?.status).toBe(StepStatus.COMPLETED);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state changes', () => {
      tracker.startWorkflow();
      for (let i = 0; i < 100; i++) {
        tracker.startStep(`step-${i % 5}`);
        if (i % 3 === 0) {
          tracker.completeStep(`step-${i % 5}`);
        } else if (i % 3 === 1) {
          tracker.skipStep(`step-${i % 5}`);
        } else {
          tracker.failStep(`step-${i % 5}`, 'Error', true);
        }
      }
      // Should not throw
      expect(tracker.progress).toBeDefined();
    });

    it('should handle concurrent step operations', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.startStep('step-2');
      tracker.startStep('step-3');

      expect(tracker.progress.runningSteps).toBe(3);

      tracker.completeStep('step-2');
      tracker.completeStep('step-1');
      tracker.completeStep('step-3');

      expect(tracker.progress.completedSteps).toBe(3);
      expect(tracker.progress.runningSteps).toBe(0);
    });

    it('should handle workflow completion after all steps', () => {
      tracker.startWorkflow();
      for (let i = 1; i <= totalSteps; i++) {
        tracker.startStep(`step-${i}`);
        tracker.completeStep(`step-${i}`);
      }
      tracker.completeWorkflow();

      expect(tracker.progress.status).toBe(WorkflowStatus.COMPLETED);
      expect(tracker.progress.progressPercentage).toBe(100);
    });

    it('should handle special characters in step names', () => {
      tracker.startWorkflow();
      const specialStepId = 'step-with-special-chars_123/abc';
      tracker.startStep(specialStepId);
      tracker.completeStep(specialStepId);

      expect(tracker.getStepProgress(specialStepId)).toBeDefined();
    });

    it('should handle very long step names in reports', () => {
      const stepNames = new Map([['long-step', 'a'.repeat(1000)]]);
      const longNameTracker = new ProgressTracker({
        ...defaultConfig,
        stepNames,
      });
      longNameTracker.startWorkflow();
      longNameTracker.startStep('long-step');

      const report = longNameTracker.generateReport({ format: 'text' as ProgressReportFormat });
      expect(report.content).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should accumulate multiple errors', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.failStep('step-1', 'Error 1', true);
      tracker.retryStep('step-1');
      tracker.failStep('step-1', 'Error 2', true);
      tracker.retryStep('step-1');
      tracker.failStep('step-1', 'Error 3', false);

      expect(tracker.progress.errors.length).toBe(3);
      expect(tracker.progress.errors[2].error).toBe('Error 3');
    });

    it('should include error context', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      tracker.failStep('step-1', 'Validation failed');

      const error = tracker.progress.errors[0];
      expect(error.stepId).toBe('step-1');
      expect(error.timestamp).toBeDefined();
    });

    it('should track workflow-level errors', () => {
      tracker.startWorkflow();
      tracker.failWorkflow('Workflow failed');

      const error = tracker.progress.errors[0];
      expect(error.stepId).toBe('workflow');
      expect(error.error).toBe('Workflow failed');
    });
  });

  describe('concurrent workflows', () => {
    it('should support multiple independent trackers', () => {
      const tracker1 = new ProgressTracker({
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowName: 'Workflow 1',
        totalSteps: 3,
      });
      const tracker2 = new ProgressTracker({
        instanceId: 'inst-2',
        workflowId: 'wf-2',
        workflowName: 'Workflow 2',
        totalSteps: 5,
      });

      tracker1.startWorkflow();
      tracker2.startWorkflow();

      tracker1.startStep('step-1');
      tracker2.startStep('step-1');

      tracker1.completeStep('step-1');
      tracker2.failStep('step-1', 'Error');

      expect(tracker1.progress.completedSteps).toBe(1);
      expect(tracker1.progress.failedSteps).toBe(0);
      expect(tracker2.progress.completedSteps).toBe(0);
      expect(tracker2.progress.failedSteps).toBe(1);
    });
  });

  describe('step name resolution', () => {
    it('should use step ID as name when not configured', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      const step = tracker.getStepProgress('step-1');
      expect(step?.name).toBe('step-1');
    });

    it('should use configured step name', () => {
      const stepNames = new Map([['step-1', 'First Step']]);
      const namedTracker = new ProgressTracker({
        ...defaultConfig,
        stepNames,
      });
      namedTracker.startWorkflow();
      namedTracker.startStep('step-1');
      const step = namedTracker.getStepProgress('step-1');
      expect(step?.name).toBe('First Step');
    });
  });

  describe('pending steps tracking', () => {
    it('should initialize pending steps correctly', () => {
      expect(tracker.progress.pendingSteps).toBe(totalSteps);
    });

    it('should decrement pending on step start', () => {
      tracker.startWorkflow();
      tracker.startStep('step-1');
      expect(tracker.progress.pendingSteps).toBe(totalSteps - 1);
    });

    it('should decrement pending on step skip', () => {
      tracker.startWorkflow();
      tracker.skipStep('step-1');
      expect(tracker.progress.pendingSteps).toBe(totalSteps - 1);
    });

    it('should not go negative', () => {
      tracker.startWorkflow();
      for (let i = 0; i < 10; i++) {
        tracker.startStep(`step-${i}`);
        tracker.completeStep(`step-${i}`);
      }
      expect(tracker.progress.pendingSteps).toBeGreaterThanOrEqual(0);
    });
  });
});

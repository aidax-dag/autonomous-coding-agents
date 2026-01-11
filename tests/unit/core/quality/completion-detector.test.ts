/**
 * CompletionDetector Test Suite
 *
 * Tests for completion detection, quality gates, and spec validation.
 */

import {
  CompletionDetector,
  CompletionStatus,
  QualityGateLevel,
  QualityDimension,
  CompletionDetectorEvent,
  QUALITY_GATES,
  createCompletionDetector,
} from '../../../../src/core/quality/completion-detector';
import {
  ProjectState,
  ProjectStatus,
  TaskStatus,
  TaskRecord,
} from '../../../../src/core/memory/project-store';
import { PRDAnalysis, PRDFeature, ComplexityLevel } from '../../../../src/core/orchestrator/task-decomposer';
import { TaskPriority } from '../../../../src/core/interfaces/agent.interface';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: 'Test Task',
    description: 'A test task',
    status: TaskStatus.PENDING,
    dependencies: [],
    attempts: 0,
    metadata: {},
    ...overrides,
  };
}

function createMockProject(overrides: Partial<ProjectState> = {}): ProjectState {
  const projectId = `project_${Date.now()}`;
  const now = new Date();
  return {
    id: projectId,
    name: 'Test Project',
    description: 'A test project',
    prd: 'Test PRD document',
    status: ProjectStatus.IN_PROGRESS,
    tasks: new Map(),
    executionOrder: [],
    currentTaskIndex: 0,
    context: {
      currentPhase: 'implementation',
      activeGoals: ['Complete testing'],
      completedMilestones: [],
      decisions: [],
      insights: [],
      blockers: [],
      custom: {},
    },
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    version: 1,
    sessionIds: [],
    metadata: {},
    ...overrides,
  };
}

function createMockPRDFeature(overrides: Partial<PRDFeature> = {}): PRDFeature {
  return {
    id: 'feature_1',
    name: 'Feature 1',
    description: 'First feature',
    priority: TaskPriority.HIGH,
    requirements: ['Req 1', 'Req 2'],
    acceptanceCriteria: ['AC1', 'AC2'],
    estimatedComplexity: ComplexityLevel.MEDIUM,
    dependencies: [],
    ...overrides,
  };
}

function createMockPRDAnalysis(features: PRDFeature[] = []): PRDAnalysis {
  return {
    id: `prd_${Date.now()}`,
    title: 'Test PRD',
    version: '1.0.0',
    overview: 'Test PRD overview',
    goals: ['Goal 1', 'Goal 2'],
    features: features.length > 0 ? features : [
      createMockPRDFeature({ id: 'feature_1', name: 'Feature 1' }),
      createMockPRDFeature({
        id: 'feature_2',
        name: 'Feature 2',
        priority: TaskPriority.NORMAL,
        dependencies: ['feature_1'],
      }),
    ],
    globalRequirements: [],
    constraints: [],
    metadata: {},
    analyzedAt: new Date(),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('CompletionDetector', () => {
  let detector: CompletionDetector;

  beforeEach(() => {
    detector = createCompletionDetector();
    // Add error listener to prevent unhandled error events
    detector.on(CompletionDetectorEvent.QUALITY_GATE_FAILED, () => {});
    detector.on(CompletionDetectorEvent.QUALITY_GATE_PASSED, () => {});
    detector.on(CompletionDetectorEvent.CHECK_STARTED, () => {});
    detector.on(CompletionDetectorEvent.CHECK_COMPLETED, () => {});
    detector.on(CompletionDetectorEvent.PROJECT_COMPLETE, () => {});
  });

  describe('Factory', () => {
    it('should create a detector with default config', () => {
      const detector = createCompletionDetector();
      expect(detector).toBeInstanceOf(CompletionDetector);
    });

    it('should create a detector with custom config', () => {
      const detector = createCompletionDetector({
        defaultQualityGateLevel: QualityGateLevel.STRICT,
        strictMode: true,
      });
      expect(detector).toBeInstanceOf(CompletionDetector);
    });
  });

  describe('getCompletionPercentage', () => {
    it('should return 0 for project with no tasks', async () => {
      const project = createMockProject();
      const percentage = await detector.getCompletionPercentage(project);
      expect(percentage).toBe(0);
    });

    it('should return 0 for project with all pending tasks', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.PENDING }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.PENDING }));

      const percentage = await detector.getCompletionPercentage(project);
      expect(percentage).toBe(0);
    });

    it('should return 50 for project with half completed tasks', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.PENDING }));

      const percentage = await detector.getCompletionPercentage(project);
      expect(percentage).toBe(50);
    });

    it('should return 100 for project with all completed tasks', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.COMPLETED }));

      const percentage = await detector.getCompletionPercentage(project);
      expect(percentage).toBe(100);
    });

    it('should count skipped tasks as completed', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.SKIPPED }));

      const percentage = await detector.getCompletionPercentage(project);
      expect(percentage).toBe(100);
    });
  });

  describe('checkTaskCompletion', () => {
    it('should fail for project with no tasks', async () => {
      const project = createMockProject();
      const result = await detector.checkTaskCompletion(project);

      expect(result.dimension).toBe(QualityDimension.TASK_COMPLETION);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toBe('No tasks defined');
    });

    it('should pass for project with 80%+ completed tasks', async () => {
      const project = createMockProject();
      for (let i = 0; i < 8; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.COMPLETED }));
      }
      for (let i = 8; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.PENDING }));
      }

      const result = await detector.checkTaskCompletion(project);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(80);
    });

    it('should fail for project with less than 80% completed tasks', async () => {
      const project = createMockProject();
      for (let i = 0; i < 7; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.COMPLETED }));
      }
      for (let i = 7; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.PENDING }));
      }

      const result = await detector.checkTaskCompletion(project);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(70);
    });

    it('should include failed tasks in details', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.FAILED }));
      project.tasks.set('task3', createMockTask({ status: TaskStatus.IN_PROGRESS }));

      const result = await detector.checkTaskCompletion(project);

      expect(result.details).toContain('1 failed');
      expect(result.details).toContain('1 in progress');
      expect(result.recommendations).toContain('Address failed tasks');
    });
  });

  describe('checkAcceptanceCriteria', () => {
    it('should return 0 for project with no tasks with acceptance criteria', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.PENDING }));

      const result = await detector.checkAcceptanceCriteria(project);

      expect(result.dimension).toBe(QualityDimension.ACCEPTANCE_CRITERIA);
      expect(result.score).toBe(0);
    });

    it('should pass for project with sufficient acceptance criteria met', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { acceptanceCriteria: ['AC1', 'AC2'] },
      }));
      project.tasks.set('task2', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { acceptanceCriteria: ['AC3'] },
      }));

      const result = await detector.checkAcceptanceCriteria(project);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should fail for project with insufficient acceptance criteria', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { acceptanceCriteria: ['AC1'] },
      }));
      project.tasks.set('task2', createMockTask({
        status: TaskStatus.PENDING,
        metadata: { acceptanceCriteria: ['AC2', 'AC3', 'AC4'] },
      }));

      const result = await detector.checkAcceptanceCriteria(project);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(25); // 1 out of 4
    });
  });

  describe('passesQualityGate', () => {
    it('should pass MINIMAL gate with 50%+ task completion', async () => {
      const project = createMockProject();
      for (let i = 0; i < 5; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.COMPLETED }));
      }
      for (let i = 5; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.PENDING }));
      }

      const passed = await detector.passesQualityGate(project, QUALITY_GATES[QualityGateLevel.MINIMAL]);
      expect(passed).toBe(true);
    });

    it('should fail MINIMAL gate with less than 50% task completion', async () => {
      const project = createMockProject();
      for (let i = 0; i < 4; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.COMPLETED }));
      }
      for (let i = 4; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.PENDING }));
      }

      const passed = await detector.passesQualityGate(project, QUALITY_GATES[QualityGateLevel.MINIMAL]);
      expect(passed).toBe(false);
    });

    it('should require all mandatory dimensions to pass for STANDARD gate', async () => {
      const project = createMockProject();
      // High task completion
      for (let i = 0; i < 9; i++) {
        project.tasks.set(`task${i}`, createMockTask({
          status: TaskStatus.COMPLETED,
          metadata: { acceptanceCriteria: ['AC1', 'AC2'] },
        }));
      }
      project.tasks.set('task9', createMockTask({ status: TaskStatus.PENDING }));

      const passed = await detector.passesQualityGate(project, QUALITY_GATES[QualityGateLevel.STANDARD]);
      expect(passed).toBe(true);
    });
  });

  describe('evaluateQualityGate', () => {
    it('should return complete result with all checks', async () => {
      const project = createMockProject();
      for (let i = 0; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({
          status: TaskStatus.COMPLETED,
          metadata: { acceptanceCriteria: ['AC1'] },
        }));
      }

      const result = await detector.evaluateQualityGate(project, QUALITY_GATES[QualityGateLevel.STANDARD]);

      expect(result.projectId).toBe(project.id);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.summary).toBeDefined();
    });

    it('should emit QUALITY_GATE_PASSED event when passed', async () => {
      const project = createMockProject();
      for (let i = 0; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({
          status: TaskStatus.COMPLETED,
          metadata: { acceptanceCriteria: ['AC1'] },
        }));
      }

      const passedHandler = jest.fn();
      detector.on(CompletionDetectorEvent.QUALITY_GATE_PASSED, passedHandler);

      await detector.evaluateQualityGate(project, QUALITY_GATES[QualityGateLevel.MINIMAL]);

      expect(passedHandler).toHaveBeenCalled();
    });

    it('should emit QUALITY_GATE_FAILED event when failed', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.PENDING }));

      const failedHandler = jest.fn();
      detector.on(CompletionDetectorEvent.QUALITY_GATE_FAILED, failedHandler);

      await detector.evaluateQualityGate(project, QUALITY_GATES[QualityGateLevel.STANDARD]);

      expect(failedHandler).toHaveBeenCalled();
    });

    it('should generate recommendations for failed checks', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.FAILED }));

      const result = await detector.evaluateQualityGate(project, QUALITY_GATES[QualityGateLevel.STANDARD]);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('checkCompletion', () => {
    it('should emit CHECK_STARTED and CHECK_COMPLETED events', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));

      const startHandler = jest.fn();
      const completeHandler = jest.fn();

      detector.on(CompletionDetectorEvent.CHECK_STARTED, startHandler);
      detector.on(CompletionDetectorEvent.CHECK_COMPLETED, completeHandler);

      await detector.checkCompletion(project);

      expect(startHandler).toHaveBeenCalledWith({ projectId: project.id });
      expect(completeHandler).toHaveBeenCalled();
    });

    it('should emit PROJECT_COMPLETE when project is complete', async () => {
      const detector = createCompletionDetector({
        defaultQualityGateLevel: QualityGateLevel.MINIMAL,
      });
      detector.on(CompletionDetectorEvent.QUALITY_GATE_PASSED, () => {});
      detector.on(CompletionDetectorEvent.CHECK_STARTED, () => {});
      detector.on(CompletionDetectorEvent.CHECK_COMPLETED, () => {});

      const completeHandler = jest.fn();
      detector.on(CompletionDetectorEvent.PROJECT_COMPLETE, completeHandler);

      const project = createMockProject({ status: ProjectStatus.IN_PROGRESS });
      for (let i = 0; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({ status: TaskStatus.COMPLETED }));
      }

      const result = await detector.checkCompletion(project);

      if (result.status === CompletionStatus.COMPLETE) {
        expect(completeHandler).toHaveBeenCalled();
      }
    });

    it('should return NOT_STARTED for CREATED projects', async () => {
      const project = createMockProject({ status: ProjectStatus.CREATED });

      const result = await detector.checkCompletion(project);

      expect(result.status).toBe(CompletionStatus.NOT_STARTED);
    });

    it('should return FAILED for FAILED projects', async () => {
      const project = createMockProject({ status: ProjectStatus.FAILED });

      const result = await detector.checkCompletion(project);

      expect(result.status).toBe(CompletionStatus.FAILED);
    });

    it('should return IN_PROGRESS for low completion', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.PENDING }));
      project.tasks.set('task3', createMockTask({ status: TaskStatus.PENDING }));
      project.tasks.set('task4', createMockTask({ status: TaskStatus.PENDING }));

      const result = await detector.checkCompletion(project);

      expect(result.status).toBe(CompletionStatus.IN_PROGRESS);
    });

    it('should return PARTIALLY_COMPLETE for moderate completion', async () => {
      const project = createMockProject();
      for (let i = 0; i < 6; i++) {
        project.tasks.set(`task${i}`, createMockTask({
          status: TaskStatus.COMPLETED,
          metadata: { acceptanceCriteria: ['AC1'] },
        }));
      }
      for (let i = 6; i < 10; i++) {
        project.tasks.set(`task${i}`, createMockTask({
          status: TaskStatus.PENDING,
          metadata: { acceptanceCriteria: ['AC1'] },
        }));
      }

      const result = await detector.checkCompletion(project);

      expect([CompletionStatus.PARTIALLY_COMPLETE, CompletionStatus.IN_PROGRESS]).toContain(result.status);
    });
  });

  describe('validateAgainstSpec', () => {
    it('should validate complete project against spec', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        id: 'task_feature_1',
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_1' },
      }));
      project.tasks.set('task2', createMockTask({
        id: 'task_feature_2',
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_2' },
      }));

      const prdAnalysis = createMockPRDAnalysis();
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1', 'feature_2'],
        acceptanceCriteria: new Map([
          ['feature_1', ['AC1', 'AC2']],
          ['feature_2', ['AC3']],
        ]),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result.valid).toBe(true);
      expect(result.missingFeatures).toHaveLength(0);
      expect(result.details.length).toBe(2);
    });

    it('should detect missing features', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_1' },
      }));

      const prdAnalysis = createMockPRDAnalysis();
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1', 'feature_2'],
        acceptanceCriteria: new Map([
          ['feature_1', ['AC1']],
          ['feature_2', ['AC2']],
        ]),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result.valid).toBe(false);
      expect(result.missingFeatures).toContain('Feature 2');
    });

    it('should detect incomplete features', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.IN_PROGRESS,
        metadata: { featureId: 'feature_1' },
      }));

      const prdAnalysis = createMockPRDAnalysis();
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1'],
        acceptanceCriteria: new Map([
          ['feature_1', ['AC1', 'AC2']],
        ]),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result.valid).toBe(false);
      expect(result.incompleteFeatures).toContain('Feature 1');
    });

    it('should calculate coverage percentage', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_1' },
      }));

      const prdAnalysis = createMockPRDAnalysis();
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1', 'feature_2'],
        acceptanceCriteria: new Map(),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result.coverage).toBeGreaterThan(0);
      expect(result.coverage).toBeLessThanOrEqual(100);
    });

    it('should detect extra features not in spec', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_1' },
      }));
      project.tasks.set('task2', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'extra_feature' },
      }));

      const prdAnalysis = createMockPRDAnalysis([
        createMockPRDFeature({ id: 'feature_1', name: 'Feature 1' }),
      ]);
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1'],
        acceptanceCriteria: new Map([
          ['feature_1', ['AC1']],
        ]),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result.extraFeatures).toContain('extra_feature');
    });
  });

  describe('Quality Gate Levels', () => {
    it('should have MINIMAL gate with single dimension', () => {
      const gate = QUALITY_GATES[QualityGateLevel.MINIMAL];
      expect(gate.dimensions.length).toBe(1);
      expect(gate.overallThreshold).toBe(50);
    });

    it('should have STANDARD gate with three dimensions', () => {
      const gate = QUALITY_GATES[QualityGateLevel.STANDARD];
      expect(gate.dimensions.length).toBe(3);
      expect(gate.overallThreshold).toBe(70);
    });

    it('should have STRICT gate with five dimensions', () => {
      const gate = QUALITY_GATES[QualityGateLevel.STRICT];
      expect(gate.dimensions.length).toBe(5);
      expect(gate.overallThreshold).toBe(85);
    });

    it('should have ENTERPRISE gate with six dimensions', () => {
      const gate = QUALITY_GATES[QualityGateLevel.ENTERPRISE];
      expect(gate.dimensions.length).toBe(6);
      expect(gate.overallThreshold).toBe(95);
    });

    it('should have all dimensions as required in ENTERPRISE gate', () => {
      const gate = QUALITY_GATES[QualityGateLevel.ENTERPRISE];
      const allRequired = gate.dimensions.every(d => d.required);
      expect(allRequired).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use custom task completion weight', async () => {
      const customDetector = createCompletionDetector({
        taskCompletionWeight: 0.8,
        acceptanceCriteriaWeight: 0.1,
        testCoverageWeight: 0.1,
      });
      customDetector.on(CompletionDetectorEvent.QUALITY_GATE_FAILED, () => {});
      customDetector.on(CompletionDetectorEvent.CHECK_STARTED, () => {});
      customDetector.on(CompletionDetectorEvent.CHECK_COMPLETED, () => {});

      expect(customDetector).toBeDefined();
    });

    it('should respect strict mode setting', () => {
      const strictDetector = createCompletionDetector({
        strictMode: true,
      });
      expect(strictDetector).toBeDefined();
    });

    it('should enable verbose mode', () => {
      const verboseDetector = createCompletionDetector({
        verbose: true,
      });
      expect(verboseDetector).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task map', async () => {
      const project = createMockProject();
      project.tasks = new Map();

      const result = await detector.checkCompletion(project);

      expect(result).toBeDefined();
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should handle project with only failed tasks', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.FAILED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.FAILED }));

      const result = await detector.checkCompletion(project);

      expect(result.qualityGatePassed).toBe(false);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle project with mixed task statuses', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.FAILED }));
      project.tasks.set('task3', createMockTask({ status: TaskStatus.IN_PROGRESS }));
      project.tasks.set('task4', createMockTask({ status: TaskStatus.PENDING }));
      project.tasks.set('task5', createMockTask({ status: TaskStatus.SKIPPED }));

      const result = await detector.checkCompletion(project);

      expect(result).toBeDefined();
      expect(result.checks.some(c => c.dimension === QualityDimension.TASK_COMPLETION)).toBe(true);
    });

    it('should handle empty acceptance criteria', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { acceptanceCriteria: [] },
      }));

      const result = await detector.checkAcceptanceCriteria(project);

      expect(result).toBeDefined();
      expect(result.score).toBe(0);
    });

    it('should handle spec with empty acceptance criteria map', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({
        status: TaskStatus.COMPLETED,
        metadata: { featureId: 'feature_1' },
      }));

      const prdAnalysis = createMockPRDAnalysis();
      const spec = {
        prdAnalysis,
        requiredFeatures: ['feature_1'],
        acceptanceCriteria: new Map(),
      };

      const result = await detector.validateAgainstSpec(project, spec);

      expect(result).toBeDefined();
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary with passed/failed counts', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.COMPLETED }));
      project.tasks.set('task2', createMockTask({ status: TaskStatus.PENDING }));

      const result = await detector.checkCompletion(project);

      expect(result.summary).toContain('quality checks');
      expect(result.summary).toContain('/');
    });

    it('should include failed dimensions in summary', async () => {
      const project = createMockProject();
      project.tasks.set('task1', createMockTask({ status: TaskStatus.PENDING }));

      const result = await detector.checkCompletion(project);

      if (result.checks.some(c => !c.passed)) {
        expect(result.summary).toContain('Failed dimensions');
      }
    });
  });

  describe('Event Handling', () => {
    it('should support multiple event listeners', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      detector.on(CompletionDetectorEvent.CHECK_STARTED, handler1);
      detector.on(CompletionDetectorEvent.CHECK_STARTED, handler2);

      const project = createMockProject();
      await detector.checkCompletion(project);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should allow removing event listeners', async () => {
      const handler = jest.fn();

      detector.on(CompletionDetectorEvent.CHECK_STARTED, handler);
      detector.off(CompletionDetectorEvent.CHECK_STARTED, handler);

      const project = createMockProject();
      await detector.checkCompletion(project);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

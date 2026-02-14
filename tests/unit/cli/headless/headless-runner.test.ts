/**
 * Headless CI/CD Mode — Unit Tests
 *
 * Covers HeadlessRunner, CIDetector, OutputFormatter, factory functions,
 * and EXIT_CODES constants.
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

// Mock the logger before any imports
jest.mock('@/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { HeadlessRunner, createHeadlessRunner } from '@/cli/headless/headless-runner';
import { CIDetector, createCIDetector } from '@/cli/headless/ci-detector';
import { OutputFormatter, createOutputFormatter } from '@/cli/headless/output-formatter';
import { EXIT_CODES } from '@/cli/headless/types';
import type { HeadlessConfig, HeadlessResult } from '@/cli/headless/types';

// ---- Helpers ----

function makeConfig(overrides: Partial<HeadlessConfig> = {}): HeadlessConfig {
  return {
    goal: 'Run tests',
    projectPath: '/tmp/project',
    outputFormat: 'json',
    timeout: 30_000,
    exitOnError: true,
    enabledFeatures: [],
    environment: {},
    ...overrides,
  };
}

function makeResult(overrides: Partial<HeadlessResult> = {}): HeadlessResult {
  return {
    success: true,
    exitCode: 0,
    goal: 'Run tests',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:01.000Z',
    duration: 1000,
    output: {
      tasks: [
        {
          id: 'goal-1',
          team: 'orchestrator',
          status: 'completed',
          description: 'Run tests',
          duration: 1000,
        },
      ],
      summary: 'Goal completed: 1/1 tasks succeeded',
      metrics: {
        totalTasks: 1,
        completedTasks: 1,
        failedTasks: 0,
        skippedTasks: 0,
        totalDuration: 1000,
      },
    },
    errors: [],
    ...overrides,
  };
}

// =========================================================================
// HeadlessRunner
// =========================================================================

describe('HeadlessRunner', () => {
  describe('execute — success (no runner / dry-run)', () => {
    it('should return a successful result', async () => {
      const runner = new HeadlessRunner({ config: makeConfig() });
      const result = await runner.execute();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.goal).toBe('Run tests');
      expect(result.output.tasks).toHaveLength(1);
      expect(result.output.tasks[0].status).toBe('completed');
      expect(result.errors).toHaveLength(0);

      runner.dispose();
    });

    it('should populate timing fields', async () => {
      const runner = new HeadlessRunner({ config: makeConfig() });
      const result = await runner.execute();

      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.output.metrics.totalDuration).toBeGreaterThanOrEqual(0);

      runner.dispose();
    });

    it('should include summary text in output', async () => {
      const runner = new HeadlessRunner({ config: makeConfig() });
      const result = await runner.execute();

      expect(result.output.summary).toContain('Goal completed');
      expect(result.output.metrics.completedTasks).toBe(1);
      expect(result.output.metrics.failedTasks).toBe(0);

      runner.dispose();
    });
  });

  describe('execute — with injected runner', () => {
    it('should call runner.start and runner.executeGoal', async () => {
      const mockRunner = {
        start: jest.fn().mockResolvedValue(undefined),
        executeGoal: jest.fn().mockResolvedValue({ success: true }),
      };
      const headless = new HeadlessRunner({
        config: makeConfig(),
        runner: mockRunner,
      });

      const result = await headless.execute();

      expect(mockRunner.start).toHaveBeenCalled();
      expect(mockRunner.executeGoal).toHaveBeenCalledWith('Run tests');
      expect(result.success).toBe(true);

      headless.dispose();
    });

    it('should record failure when runner.executeGoal throws', async () => {
      const mockRunner = {
        start: jest.fn().mockResolvedValue(undefined),
        executeGoal: jest.fn().mockRejectedValue(new Error('LLM quota exceeded')),
      };
      const headless = new HeadlessRunner({
        config: makeConfig(),
        runner: mockRunner,
      });

      const result = await headless.execute();

      expect(result.success).toBe(false);
      expect(result.output.tasks[0].status).toBe('failed');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('GOAL_FAILED');
      expect(result.errors[0].message).toBe('LLM quota exceeded');

      headless.dispose();
    });

    it('should record failure when runner.start throws', async () => {
      const mockRunner = {
        start: jest.fn().mockRejectedValue(new Error('Cannot connect')),
        executeGoal: jest.fn(),
      };
      const headless = new HeadlessRunner({
        config: makeConfig(),
        runner: mockRunner,
      });

      const result = await headless.execute();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1); // GOAL_FAILED (caught in runGoal)
      expect(result.errors.some((e) => e.code === 'GOAL_FAILED')).toBe(true);
      expect(result.errors[0].message).toBe('Cannot connect');

      headless.dispose();
    });
  });

  describe('execute — timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return failed result when execution exceeds timeout', async () => {
      // Create a runner whose executeGoal never resolves on its own
      let _resolveGoal: (() => void) | undefined;
      const slowRunner = {
        start: jest.fn().mockResolvedValue(undefined),
        executeGoal: jest.fn(
          () => new Promise<void>((resolve) => { _resolveGoal = resolve; }),
        ),
      };
      const headless = new HeadlessRunner({
        config: makeConfig({ timeout: 100 }),
        runner: slowRunner,
      });

      const resultPromise = headless.execute();

      // Advance time past the timeout
      jest.advanceTimersByTime(200);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'TIMEOUT')).toBe(true);

      // Clean up the hanging promise so it does not leak
      if (_resolveGoal) _resolveGoal();

      headless.dispose();
    });
  });

  describe('events', () => {
    it('should emit "started" event', async () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      const started = jest.fn();
      headless.on('started', started);

      await headless.execute();

      expect(started).toHaveBeenCalledWith(
        expect.objectContaining({ goal: 'Run tests' }),
      );

      headless.dispose();
    });

    it('should emit "completed" event on success', async () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      const completed = jest.fn();
      headless.on('completed', completed);

      await headless.execute();

      expect(completed).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );

      headless.dispose();
    });

    it('should emit "failed" event on runtime error', async () => {
      // To trigger the outer catch block in execute(), we need an error
      // that escapes runGoal(). We achieve this by subclassing and
      // overriding the private executeWithTimeout via prototype patching.
      const headless = new HeadlessRunner({ config: makeConfig() });
      const failed = jest.fn();
      headless.on('failed', failed);

      // Patch the private method to simulate an unexpected runtime error
      (headless as any).executeWithTimeout = jest.fn().mockRejectedValue(
        new Error('Unexpected crash'),
      );

      await headless.execute();

      expect(failed).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, exitCode: 4 }),
      );

      headless.dispose();
    });

    it('should emit "errorOccurred" event for each collected error', async () => {
      const mockRunner = {
        start: jest.fn().mockResolvedValue(undefined),
        executeGoal: jest.fn().mockRejectedValue(new Error('fail')),
      };
      const headless = new HeadlessRunner({
        config: makeConfig(),
        runner: mockRunner,
      });
      const errorCb = jest.fn();
      headless.on('errorOccurred', errorCb);

      await headless.execute();

      expect(errorCb).toHaveBeenCalled();

      headless.dispose();
    });
  });

  describe('dispose', () => {
    it('should clear internal state and remove listeners', () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      headless.on('started', jest.fn());

      headless.dispose();

      expect(headless.listenerCount('started')).toBe(0);
    });

    it('should be idempotent', () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      headless.dispose();
      headless.dispose(); // should not throw
    });
  });

  describe('CI detection delegation', () => {
    it('getCIEnvironment should return CIEnvironment', () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      const env = headless.getCIEnvironment();

      expect(env).toHaveProperty('provider');

      headless.dispose();
    });

    it('isCI should return boolean', () => {
      const headless = new HeadlessRunner({ config: makeConfig() });
      const result = headless.isCI();

      expect(typeof result).toBe('boolean');

      headless.dispose();
    });
  });
});

// =========================================================================
// CIDetector
// =========================================================================

describe('CIDetector', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...savedEnv };
  });

  describe('detect', () => {
    it('should detect GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_RUN_ID = '12345';
      process.env.GITHUB_REF_NAME = 'main';
      process.env.GITHUB_SHA = 'abc123';
      process.env.GITHUB_REPOSITORY = 'org/repo';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('github-actions');
      expect(env.runId).toBe('12345');
      expect(env.branch).toBe('main');
      expect(env.commit).toBe('abc123');
      expect(env.repository).toBe('org/repo');
    });

    it('should detect GitHub Actions PR number', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_REF = 'refs/pull/42/merge';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('github-actions');
      expect(env.prNumber).toBe(42);
    });

    it('should detect GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_PIPELINE_ID = '999';
      process.env.CI_COMMIT_BRANCH = 'develop';
      process.env.CI_COMMIT_SHA = 'def456';
      process.env.CI_PROJECT_PATH = 'group/project';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('gitlab-ci');
      expect(env.runId).toBe('999');
      expect(env.branch).toBe('develop');
      expect(env.commit).toBe('def456');
      expect(env.repository).toBe('group/project');
    });

    it('should detect GitLab CI merge request', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_MERGE_REQUEST_IID = '7';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('gitlab-ci');
      expect(env.prNumber).toBe(7);
    });

    it('should detect Jenkins', () => {
      process.env.JENKINS_URL = 'https://jenkins.example.com';
      process.env.BUILD_NUMBER = '88';
      process.env.GIT_BRANCH = 'feature/foo';
      process.env.GIT_COMMIT = 'ghi789';
      process.env.JOB_NAME = 'my-job';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('jenkins');
      expect(env.runId).toBe('88');
      expect(env.branch).toBe('feature/foo');
      expect(env.commit).toBe('ghi789');
      expect(env.repository).toBe('my-job');
    });

    it('should detect CircleCI', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BUILD_NUM = '55';
      process.env.CIRCLE_BRANCH = 'release/1.0';
      process.env.CIRCLE_SHA1 = 'jkl012';
      process.env.CIRCLE_PROJECT_USERNAME = 'myorg';
      process.env.CIRCLE_PROJECT_REPONAME = 'myrepo';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('circleci');
      expect(env.runId).toBe('55');
      expect(env.branch).toBe('release/1.0');
      expect(env.commit).toBe('jkl012');
      expect(env.repository).toBe('myorg/myrepo');
    });

    it('should detect CircleCI PR number', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_PULL_REQUEST = 'https://github.com/org/repo/pull/99';

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('circleci');
      expect(env.prNumber).toBe(99);
    });

    it('should return unknown when no CI environment is detected', () => {
      // Remove all CI markers
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.JENKINS_URL;
      delete process.env.CIRCLECI;
      delete process.env.CI;
      delete process.env.CONTINUOUS_INTEGRATION;
      delete process.env.BUILD_NUMBER;

      const detector = new CIDetector();
      const env = detector.detect();

      expect(env.provider).toBe('unknown');
    });
  });

  describe('isCI', () => {
    it('should return true when CI=true', () => {
      process.env.CI = 'true';
      const detector = new CIDetector();
      expect(detector.isCI()).toBe(true);
    });

    it('should return true when CONTINUOUS_INTEGRATION is set', () => {
      delete process.env.CI;
      process.env.CONTINUOUS_INTEGRATION = '1';
      const detector = new CIDetector();
      expect(detector.isCI()).toBe(true);
    });

    it('should return true when BUILD_NUMBER is set', () => {
      delete process.env.CI;
      delete process.env.CONTINUOUS_INTEGRATION;
      process.env.BUILD_NUMBER = '42';
      const detector = new CIDetector();
      expect(detector.isCI()).toBe(true);
    });

    it('should return false when no CI variables are set', () => {
      delete process.env.CI;
      delete process.env.CONTINUOUS_INTEGRATION;
      delete process.env.BUILD_NUMBER;
      const detector = new CIDetector();
      expect(detector.isCI()).toBe(false);
    });
  });
});

// =========================================================================
// OutputFormatter
// =========================================================================

describe('OutputFormatter', () => {
  const result = makeResult();

  describe('JSON format', () => {
    it('should produce valid JSON with indentation', () => {
      const formatter = new OutputFormatter('json');
      const output = formatter.formatResult(result);
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.goal).toBe('Run tests');
      expect(parsed.output.metrics.completedTasks).toBe(1);
    });

    it('should be the default format', () => {
      const formatter = new OutputFormatter();
      const output = formatter.formatResult(result);
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('JSONL format', () => {
    it('should produce one JSON object per line', () => {
      const formatter = new OutputFormatter('jsonl');
      const output = formatter.formatResult(result);
      const lines = output.split('\n');

      // header + 1 task + summary = 3 lines (no errors)
      expect(lines.length).toBe(3);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it('should include header, task, and summary types', () => {
      const formatter = new OutputFormatter('jsonl');
      const output = formatter.formatResult(result);
      const lines = output.split('\n').map((l) => JSON.parse(l));

      expect(lines[0].type).toBe('header');
      expect(lines[1].type).toBe('task');
      expect(lines[2].type).toBe('summary');
    });

    it('should include error lines when errors are present', () => {
      const errResult = makeResult({
        errors: [
          { code: 'TIMEOUT', message: 'timed out', fatal: true, timestamp: '2026-01-01T00:00:02.000Z' },
        ],
      });
      const formatter = new OutputFormatter('jsonl');
      const output = formatter.formatResult(errResult);
      const lines = output.split('\n').map((l) => JSON.parse(l));
      const errorLine = lines.find((l: any) => l.type === 'error');

      expect(errorLine).toBeDefined();
      expect(errorLine.code).toBe('TIMEOUT');
    });
  });

  describe('minimal format', () => {
    it('should show PASS for successful results', () => {
      const formatter = new OutputFormatter('minimal');
      const output = formatter.formatResult(result);

      expect(output).toContain('[PASS]');
      expect(output).toContain('Run tests');
      expect(output).toContain('Duration:');
      expect(output).toContain('Tasks: 1/1 passed');
    });

    it('should show FAIL for failed results', () => {
      const failedResult = makeResult({
        success: false,
        errors: [
          { code: 'GOAL_FAILED', message: 'Tests broke', fatal: true, timestamp: '2026-01-01T00:00:02.000Z' },
        ],
      });
      const formatter = new OutputFormatter('minimal');
      const output = formatter.formatResult(failedResult);

      expect(output).toContain('[FAIL]');
      expect(output).toContain('Errors:');
      expect(output).toContain('[GOAL_FAILED] Tests broke');
    });
  });

  describe('GitHub Actions annotations', () => {
    it('should produce ::notice:: for success', () => {
      const formatter = new OutputFormatter();
      const output = formatter.formatGitHubAnnotations(result);

      expect(output).toContain('::notice::');
      expect(output).toContain('Goal completed successfully');
    });

    it('should produce ::error:: for failure', () => {
      const failedResult = makeResult({ success: false });
      const formatter = new OutputFormatter();
      const output = formatter.formatGitHubAnnotations(failedResult);

      expect(output).toContain('::error::Goal failed');
    });

    it('should emit ::error:: for fatal errors and ::warning:: for non-fatal', () => {
      const mixedResult = makeResult({
        success: false,
        errors: [
          { code: 'GOAL_FAILED', message: 'fatal issue', fatal: true, timestamp: '' },
          { code: 'WARN', message: 'minor issue', fatal: false, timestamp: '' },
        ],
      });
      const formatter = new OutputFormatter();
      const output = formatter.formatGitHubAnnotations(mixedResult);

      expect(output).toContain('::error::fatal issue');
      expect(output).toContain('::warning::minor issue');
    });

    it('should include execution summary group', () => {
      const formatter = new OutputFormatter();
      const output = formatter.formatGitHubAnnotations(result);

      expect(output).toContain('::group::Execution Summary');
      expect(output).toContain('::endgroup::');
    });
  });

  describe('GitHub Actions outputs', () => {
    it('should emit set-output lines', () => {
      const formatter = new OutputFormatter();
      const output = formatter.formatGitHubOutputs(result);

      expect(output).toContain('::set-output name=success::true');
      expect(output).toContain('::set-output name=exit-code::0');
      expect(output).toContain('::set-output name=duration::1000');
      expect(output).toContain('::set-output name=tasks-total::1');
      expect(output).toContain('::set-output name=tasks-passed::1');
      expect(output).toContain('::set-output name=tasks-failed::0');
    });
  });
});

// =========================================================================
// Factory Functions
// =========================================================================

describe('factory functions', () => {
  it('createHeadlessRunner should return a HeadlessRunner', () => {
    const runner = createHeadlessRunner(makeConfig());
    expect(runner).toBeInstanceOf(HeadlessRunner);
    runner.dispose();
  });

  it('createHeadlessRunner should accept an optional runner', () => {
    const mockRunner = { start: jest.fn(), executeGoal: jest.fn() };
    const runner = createHeadlessRunner(makeConfig(), mockRunner);
    expect(runner).toBeInstanceOf(HeadlessRunner);
    runner.dispose();
  });

  it('createOutputFormatter should return an OutputFormatter', () => {
    const formatter = createOutputFormatter('minimal');
    expect(formatter).toBeInstanceOf(OutputFormatter);
  });

  it('createOutputFormatter should default to json', () => {
    const formatter = createOutputFormatter();
    const result = makeResult();
    const output = formatter.formatResult(result);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('createCIDetector should return a CIDetector', () => {
    const detector = createCIDetector();
    expect(detector).toBeInstanceOf(CIDetector);
  });
});

// =========================================================================
// EXIT_CODES
// =========================================================================

describe('EXIT_CODES', () => {
  it('should have SUCCESS = 0', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it('should have GOAL_FAILED = 1', () => {
    expect(EXIT_CODES.GOAL_FAILED).toBe(1);
  });

  it('should have TIMEOUT = 2', () => {
    expect(EXIT_CODES.TIMEOUT).toBe(2);
  });

  it('should have CONFIG_ERROR = 3', () => {
    expect(EXIT_CODES.CONFIG_ERROR).toBe(3);
  });

  it('should have RUNTIME_ERROR = 4', () => {
    expect(EXIT_CODES.RUNTIME_ERROR).toBe(4);
  });
});

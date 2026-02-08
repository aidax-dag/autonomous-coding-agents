/**
 * CI Checker Tests
 */

import { CIChecker } from '../../../../src/shared/ci/ci-checker';
import type { CIStatus, CheckRun } from '../../../../src/shared/ci/types';

// ============================================================================
// Mock Octokit
// ============================================================================

const mockListForRef = jest.fn();

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      checks: {
        listForRef: mockListForRef,
      },
    },
  })),
}));

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeCheckRun(overrides: Partial<{
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  details_url: string | null;
  output: { title: string; summary: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'test-check',
    status: overrides.status ?? 'completed',
    conclusion: overrides.conclusion ?? 'success',
    started_at: overrides.started_at ?? '2025-01-01T00:00:00Z',
    completed_at: overrides.completed_at ?? '2025-01-01T00:01:00Z',
    details_url: overrides.details_url ?? null,
    output: overrides.output ?? { title: 'Test', summary: 'OK' },
  };
}

function makeCIStatus(overrides: Partial<CIStatus> = {}): CIStatus {
  return {
    provider: 'github-actions',
    sha: 'abc123',
    status: 'completed',
    conclusion: 'success',
    checkRuns: [],
    totalCount: 0,
    completedCount: 0,
    ...overrides,
  };
}

function makeCheckRunResult(overrides: Partial<CheckRun> = {}): CheckRun {
  return {
    id: 1,
    name: 'test',
    status: 'completed',
    conclusion: 'success',
    startedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('CIChecker', () => {
  let checker: CIChecker;

  beforeEach(() => {
    jest.clearAllMocks();
    checker = new CIChecker('ghp_test_token');
  });

  // ==========================================================================
  // Constructor & Config
  // ==========================================================================

  describe('constructor', () => {
    it('should use default config', () => {
      const config = checker.getConfig();
      expect(config.provider).toBe('github-actions');
      expect(config.timeout).toBe(600000);
      expect(config.pollInterval).toBe(10000);
      expect(config.minCoverage).toBe(80);
    });

    it('should merge custom config', () => {
      const custom = new CIChecker('token', { minCoverage: 90, timeout: 300000 });
      const config = custom.getConfig();
      expect(config.minCoverage).toBe(90);
      expect(config.timeout).toBe(300000);
      expect(config.provider).toBe('github-actions');
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      checker.updateConfig({ minCoverage: 95 });
      expect(checker.getConfig().minCoverage).toBe(95);
    });
  });

  describe('getConfig', () => {
    it('should return a copy', () => {
      const config1 = checker.getConfig();
      const config2 = checker.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  // ==========================================================================
  // getStatus
  // ==========================================================================

  describe('getStatus', () => {
    it('should return status with all checks completed successfully', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ id: 1, name: 'build' }),
            makeCheckRun({ id: 2, name: 'test' }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha123');
      expect(status.status).toBe('completed');
      expect(status.conclusion).toBe('success');
      expect(status.totalCount).toBe(2);
      expect(status.completedCount).toBe(2);
      expect(status.checkRuns).toHaveLength(2);
    });

    it('should detect in_progress status', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ status: 'completed' }),
            makeCheckRun({ status: 'in_progress', conclusion: null }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.status).toBe('in_progress');
    });

    it('should detect queued status', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ status: 'completed' }),
            makeCheckRun({ status: 'queued', conclusion: null }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.status).toBe('queued');
    });

    it('should detect failure conclusion', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ conclusion: 'success' }),
            makeCheckRun({ conclusion: 'failure' }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.conclusion).toBe('failure');
    });

    it('should detect cancelled conclusion', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ conclusion: 'success' }),
            makeCheckRun({ conclusion: 'cancelled' }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.conclusion).toBe('cancelled');
    });

    it('should detect action_required conclusion', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ conclusion: 'success' }),
            makeCheckRun({ conclusion: 'action_required' }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.conclusion).toBe('action_required');
    });

    it('should filter by required checks', async () => {
      const custom = new CIChecker('token', { requiredChecks: ['build'] });
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ name: 'build' }),
            makeCheckRun({ name: 'lint', conclusion: 'failure' }),
          ],
        },
      });

      const status = await custom.getStatus('owner', 'repo', 'sha');
      expect(status.totalCount).toBe(1);
      expect(status.conclusion).toBe('success');
    });

    it('should re-throw API errors', async () => {
      mockListForRef.mockRejectedValue(new Error('API error'));
      await expect(checker.getStatus('owner', 'repo', 'sha')).rejects.toThrow('API error');
    });

    it('should handle empty check runs', async () => {
      mockListForRef.mockResolvedValue({ data: { check_runs: [] } });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.totalCount).toBe(0);
      expect(status.completedCount).toBe(0);
      expect(status.conclusion).toBe('success');
    });

    it('should map check run output', async () => {
      mockListForRef.mockResolvedValue({
        data: {
          check_runs: [
            makeCheckRun({ output: { title: 'Report', summary: 'All good' } }),
          ],
        },
      });

      const status = await checker.getStatus('owner', 'repo', 'sha');
      expect(status.checkRuns[0].output).toEqual({ title: 'Report', summary: 'All good' });
    });
  });

  // ==========================================================================
  // isPassed / isFailed
  // ==========================================================================

  describe('isPassed', () => {
    it('should return true for completed success', () => {
      expect(checker.isPassed(makeCIStatus({ status: 'completed', conclusion: 'success' }))).toBe(true);
    });

    it('should return false for completed failure', () => {
      expect(checker.isPassed(makeCIStatus({ status: 'completed', conclusion: 'failure' }))).toBe(false);
    });

    it('should return false for in_progress', () => {
      expect(checker.isPassed(makeCIStatus({ status: 'in_progress' }))).toBe(false);
    });
  });

  describe('isFailed', () => {
    it('should return true for failure', () => {
      expect(checker.isFailed(makeCIStatus({ status: 'completed', conclusion: 'failure' }))).toBe(true);
    });

    it('should return true for timed_out', () => {
      expect(checker.isFailed(makeCIStatus({ status: 'completed', conclusion: 'timed_out' }))).toBe(true);
    });

    it('should return false for success', () => {
      expect(checker.isFailed(makeCIStatus({ status: 'completed', conclusion: 'success' }))).toBe(false);
    });

    it('should return false for cancelled', () => {
      expect(checker.isFailed(makeCIStatus({ status: 'completed', conclusion: 'cancelled' }))).toBe(false);
    });
  });

  // ==========================================================================
  // getFailedChecks
  // ==========================================================================

  describe('getFailedChecks', () => {
    it('should return failed and timed_out checks', () => {
      const status = makeCIStatus({
        checkRuns: [
          makeCheckRunResult({ name: 'build', conclusion: 'success' }),
          makeCheckRunResult({ name: 'test', conclusion: 'failure' }),
          makeCheckRunResult({ name: 'lint', conclusion: 'timed_out' }),
          makeCheckRunResult({ name: 'deploy', status: 'in_progress' }),
        ],
      });
      const failed = checker.getFailedChecks(status);
      expect(failed).toHaveLength(2);
      expect(failed.map((c) => c.name)).toEqual(['test', 'lint']);
    });

    it('should return empty for all passed', () => {
      const status = makeCIStatus({
        checkRuns: [makeCheckRunResult({ conclusion: 'success' })],
      });
      expect(checker.getFailedChecks(status)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // formatStatus
  // ==========================================================================

  describe('formatStatus', () => {
    it('should include overall status', () => {
      const output = checker.formatStatus(makeCIStatus());
      expect(output).toContain('Overall Status: completed');
    });

    it('should include conclusion when present', () => {
      const output = checker.formatStatus(makeCIStatus({ conclusion: 'success' }));
      expect(output).toContain('Conclusion: success');
    });

    it('should not include conclusion when absent', () => {
      const output = checker.formatStatus(makeCIStatus({ status: 'in_progress', conclusion: undefined }));
      expect(output).not.toContain('Conclusion:');
    });

    it('should include completed count', () => {
      const output = checker.formatStatus(makeCIStatus({ completedCount: 3, totalCount: 5 }));
      expect(output).toContain('Completed: 3/5');
    });

    it('should list check runs with icons', () => {
      const output = checker.formatStatus(makeCIStatus({
        checkRuns: [
          makeCheckRunResult({ name: 'build', conclusion: 'success' }),
          makeCheckRunResult({ name: 'test', conclusion: 'failure' }),
        ],
      }));
      expect(output).toContain('build');
      expect(output).toContain('test');
    });

    it('should include coverage when present', () => {
      const output = checker.formatStatus(makeCIStatus({ coverage: 85 }));
      expect(output).toContain('Coverage: 85%');
    });

    it('should not include coverage when absent', () => {
      const output = checker.formatStatus(makeCIStatus());
      expect(output).not.toContain('Coverage:');
    });
  });

  // ==========================================================================
  // waitForCompletion
  // ==========================================================================

  describe('waitForCompletion', () => {
    it('should return immediately when already completed', async () => {
      mockListForRef.mockResolvedValue({
        data: { check_runs: [makeCheckRun()] },
      });

      const status = await checker.waitForCompletion('owner', 'repo', 'sha', 5000);
      expect(status.status).toBe('completed');
      expect(mockListForRef).toHaveBeenCalledTimes(1);
    });

    it('should poll until completed', async () => {
      const inProgress = { data: { check_runs: [makeCheckRun({ status: 'in_progress', conclusion: null })] } };
      const completed = { data: { check_runs: [makeCheckRun()] } };

      mockListForRef
        .mockResolvedValueOnce(inProgress)
        .mockResolvedValueOnce(completed);

      // Use short poll interval
      const fast = new CIChecker('token', { pollInterval: 10 });
      const status = await fast.waitForCompletion('owner', 'repo', 'sha', 5000);
      expect(status.status).toBe('completed');
      expect(mockListForRef).toHaveBeenCalledTimes(2);
    });

    it('should return final status on timeout', async () => {
      const inProgress = { data: { check_runs: [makeCheckRun({ status: 'in_progress', conclusion: null })] } };

      mockListForRef.mockResolvedValue(inProgress);

      const fast = new CIChecker('token', { pollInterval: 10 });
      const status = await fast.waitForCompletion('owner', 'repo', 'sha', 50);
      expect(status.status).toBe('in_progress');
    });
  });
});

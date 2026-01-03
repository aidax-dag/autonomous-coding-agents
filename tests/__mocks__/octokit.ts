/**
 * Mock for octokit ESM module
 *
 * Jest cannot transform ESM-only packages by default.
 * This mock provides a compatible CJS module for testing.
 */

export class Octokit {
  constructor(_options?: { auth?: string }) {
    // Mock constructor
  }

  rest = {
    checks: {
      listForRef: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    actions: {
      listWorkflowRunsForRepo: jest.fn(),
      getWorkflowRun: jest.fn(),
      listJobsForWorkflowRun: jest.fn(),
      reRunWorkflow: jest.fn(),
      cancelWorkflowRun: jest.fn(),
    },
    repos: {
      getCombinedStatusForRef: jest.fn(),
      listCommitStatusesForRef: jest.fn(),
    },
    pulls: {
      get: jest.fn(),
      listCommits: jest.fn(),
    },
  };
}

export default { Octokit };

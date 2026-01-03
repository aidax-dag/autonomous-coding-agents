/**
 * Mock for @octokit/rest ESM module
 *
 * Jest cannot transform ESM-only packages by default.
 * This mock provides a compatible CJS module for testing.
 */

export class Octokit {
  constructor(_options?: { auth?: string }) {
    // Mock constructor
  }

  rest = {
    pulls: {
      create: jest.fn(),
      get: jest.fn(),
      merge: jest.fn(),
      list: jest.fn(),
      listFiles: jest.fn(),
      listReviews: jest.fn(),
      createReview: jest.fn(),
      listReviewComments: jest.fn(),
      createReviewComment: jest.fn(),
    },
    repos: {
      get: jest.fn(),
      getContent: jest.fn(),
      createOrUpdateFileContents: jest.fn(),
      deleteFile: jest.fn(),
      getBranch: jest.fn(),
      listBranches: jest.fn(),
      compareCommits: jest.fn(),
    },
    git: {
      getRef: jest.fn(),
      createRef: jest.fn(),
      deleteRef: jest.fn(),
      getCommit: jest.fn(),
      createCommit: jest.fn(),
      getTree: jest.fn(),
      createTree: jest.fn(),
      createBlob: jest.fn(),
    },
    issues: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
    },
  };
}

export default { Octokit };

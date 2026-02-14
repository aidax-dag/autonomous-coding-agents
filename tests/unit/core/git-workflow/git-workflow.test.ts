/**
 * Tests for Git Workflow Module
 *
 * Covers BranchStrategist, ConflictResolver, PRReviewer, and integration
 * scenarios for the intelligent git workflow system.
 */

import { BranchStrategist } from '@/core/git-workflow/branch-strategist';
import { ConflictResolver } from '@/core/git-workflow/conflict-resolver';
import { PRReviewer } from '@/core/git-workflow/pr-reviewer';
import type { PRFile } from '@/core/git-workflow/pr-reviewer';
import type {
  GitWorkflowConfig,
  BranchRecommendation,
  ConflictInfo,
  ConflictResolutionResult,
  PRReviewResult,
} from '@/core/git-workflow/types';
import { DEFAULT_GIT_WORKFLOW_CONFIG } from '@/core/git-workflow/types';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(overrides: Partial<GitWorkflowConfig> = {}): GitWorkflowConfig {
  return { ...DEFAULT_GIT_WORKFLOW_CONFIG, ...overrides };
}

function makeConflict(overrides: Partial<ConflictInfo> = {}): ConflictInfo {
  return {
    filePath: 'src/example.ts',
    conflictType: 'content',
    oursContent: 'const x = 1;',
    theirsContent: 'const x = 2;',
    markers: { start: 0, separator: 2, end: 4 },
    ...overrides,
  };
}

function makePRFile(overrides: Partial<PRFile> = {}): PRFile {
  return {
    path: 'src/feature.ts',
    additions: 20,
    deletions: 5,
    status: 'modified',
    ...overrides,
  };
}

// ============================================================================
// BranchStrategist
// ============================================================================

describe('BranchStrategist', () => {
  let strategist: BranchStrategist;

  beforeEach(() => {
    strategist = new BranchStrategist(makeConfig());
  });

  describe('strategy detection', () => {
    it('should detect bugfix strategy from "fix" keyword', () => {
      const result = strategist.recommend('Fix the login error');
      expect(result.strategy).toBe('bugfix');
    });

    it('should detect bugfix strategy from "bug" keyword', () => {
      const result = strategist.recommend('Resolve a bug in user signup');
      expect(result.strategy).toBe('bugfix');
    });

    it('should detect bugfix strategy from "crash" keyword', () => {
      const result = strategist.recommend('App crash on startup');
      expect(result.strategy).toBe('bugfix');
    });

    it('should detect hotfix strategy from "hotfix" keyword', () => {
      const result = strategist.recommend('Hotfix for payment processing');
      expect(result.strategy).toBe('hotfix');
    });

    it('should detect hotfix strategy from "urgent" keyword', () => {
      const result = strategist.recommend('Urgent: database connection timeout');
      expect(result.strategy).toBe('hotfix');
    });

    it('should detect hotfix strategy from "critical" keyword', () => {
      const result = strategist.recommend('Critical security vulnerability');
      expect(result.strategy).toBe('hotfix');
    });

    it('should detect release strategy from "release" keyword', () => {
      const result = strategist.recommend('Release version 2.0');
      expect(result.strategy).toBe('release');
    });

    it('should detect release strategy from version pattern', () => {
      const result = strategist.recommend('Prepare v1.5 for deployment');
      expect(result.strategy).toBe('release');
    });

    it('should detect refactor strategy from "refactor" keyword', () => {
      const result = strategist.recommend('Refactor authentication module');
      expect(result.strategy).toBe('refactor');
    });

    it('should detect refactor strategy from "cleanup" keyword', () => {
      const result = strategist.recommend('Cleanup unused imports');
      expect(result.strategy).toBe('refactor');
    });

    it('should detect docs strategy from "doc" keyword', () => {
      const result = strategist.recommend('Update API documentation');
      expect(result.strategy).toBe('docs');
    });

    it('should detect docs strategy from "readme" keyword', () => {
      const result = strategist.recommend('Improve README instructions');
      expect(result.strategy).toBe('docs');
    });

    it('should detect test strategy from "test" keyword', () => {
      const result = strategist.recommend('Add unit tests for auth module');
      expect(result.strategy).toBe('test');
    });

    it('should detect test strategy from "coverage" keyword', () => {
      const result = strategist.recommend('Increase test coverage');
      expect(result.strategy).toBe('test');
    });

    it('should default to feature when no keywords match', () => {
      const result = strategist.recommend('Add user profile page');
      expect(result.strategy).toBe('feature');
    });
  });

  describe('branch name generation', () => {
    it('should generate branch name with strategy prefix', () => {
      const result = strategist.recommend('Fix the login error');
      expect(result.branchName).toMatch(/^bugfix\//);
      expect(result.branchName).toContain('login');
    });

    it('should generate branch name without prefix when disabled', () => {
      const noPrefixStrategist = new BranchStrategist(makeConfig({ branchPrefix: false }));
      const result = noPrefixStrategist.recommend('Fix the login error');
      expect(result.branchName).not.toContain('/');
    });

    it('should slugify the description', () => {
      const result = strategist.recommend('Add User Profile Page!!! @#$');
      expect(result.branchName).toMatch(/^feature\/add-user-profile-page$/);
    });

    it('should truncate long branch names', () => {
      const longDesc = 'Implement the extremely long and detailed feature that spans many words and concepts';
      const result = strategist.recommend(longDesc);
      // Strategy prefix + slug should be reasonable length
      expect(result.branchName.length).toBeLessThanOrEqual(60);
    });
  });

  describe('base branch selection', () => {
    it('should use default base branch for feature', () => {
      const result = strategist.recommend('Add user profile');
      expect(result.baseBranch).toBe('main');
    });

    it('should use default base branch for hotfix', () => {
      const result = strategist.recommend('Hotfix payment failure');
      expect(result.baseBranch).toBe('main');
    });

    it('should respect custom default base branch', () => {
      const customStrategist = new BranchStrategist(makeConfig({ defaultBaseBranch: 'develop' }));
      const result = customStrategist.recommend('Add new feature');
      expect(result.baseBranch).toBe('develop');
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence when keywords match clearly', () => {
      const result = strategist.recommend('Fix critical bug in authentication');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should have lower confidence for default strategy', () => {
      const result = strategist.recommend('Add user profile page');
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });

    it('should boost confidence with matching file hints', () => {
      const withFiles = strategist.recommend('Update documentation', ['docs/api.md', 'README.md']);
      const withoutFiles = strategist.recommend('Update documentation');
      expect(withFiles.confidence).toBeGreaterThanOrEqual(withoutFiles.confidence);
    });
  });

  describe('file-based hints', () => {
    it('should detect docs strategy from markdown files', () => {
      const result = strategist.recommend('Update the guides', ['docs/setup.md', 'docs/usage.md']);
      expect(result.strategy).toBe('docs');
    });

    it('should detect test strategy from test files', () => {
      const result = strategist.recommend('Improve the module', ['tests/auth.test.ts', 'tests/user.spec.ts']);
      expect(result.strategy).toBe('test');
    });

    it('should prefer description keywords over file hints', () => {
      // "Fix" keyword should override test file hints
      const result = strategist.recommend('Fix the broken tests', ['tests/auth.test.ts']);
      expect(result.strategy).toBe('bugfix');
    });
  });

  describe('recommendation completeness', () => {
    it('should return all required fields', () => {
      const result: BranchRecommendation = strategist.recommend('Add user auth');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('branchName');
      expect(result).toHaveProperty('baseBranch');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// ConflictResolver
// ============================================================================

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver(makeConfig({ autoResolveConflicts: true }));
  });

  describe('parseConflicts', () => {
    it('should parse a single conflict from content', () => {
      const content = [
        'line before',
        '<<<<<<< HEAD',
        'const x = 1;',
        '=======',
        'const x = 2;',
        '>>>>>>> feature',
        'line after',
      ].join('\n');

      const conflicts = resolver.parseConflicts(content, 'src/file.ts');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].oursContent).toBe('const x = 1;');
      expect(conflicts[0].theirsContent).toBe('const x = 2;');
      expect(conflicts[0].filePath).toBe('src/file.ts');
    });

    it('should parse multiple conflicts', () => {
      const content = [
        '<<<<<<< HEAD',
        'first ours',
        '=======',
        'first theirs',
        '>>>>>>> feature',
        'between',
        '<<<<<<< HEAD',
        'second ours',
        '=======',
        'second theirs',
        '>>>>>>> feature',
      ].join('\n');

      const conflicts = resolver.parseConflicts(content, 'src/file.ts');
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].oursContent).toBe('first ours');
      expect(conflicts[1].oursContent).toBe('second ours');
    });

    it('should parse multi-line conflict content', () => {
      const content = [
        '<<<<<<< HEAD',
        'line1',
        'line2',
        'line3',
        '=======',
        'other1',
        'other2',
        '>>>>>>> feature',
      ].join('\n');

      const conflicts = resolver.parseConflicts(content);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].oursContent).toBe('line1\nline2\nline3');
      expect(conflicts[0].theirsContent).toBe('other1\nother2');
    });

    it('should return empty array for content without conflicts', () => {
      const content = 'normal code\nno conflicts here\n';
      const conflicts = resolver.parseConflicts(content);
      expect(conflicts).toHaveLength(0);
    });

    it('should record correct marker positions', () => {
      const content = [
        'before',
        '<<<<<<< HEAD',
        'ours',
        '=======',
        'theirs',
        '>>>>>>> feature',
        'after',
      ].join('\n');

      const conflicts = resolver.parseConflicts(content);
      expect(conflicts[0].markers.start).toBe(1);
      expect(conflicts[0].markers.separator).toBe(3);
      expect(conflicts[0].markers.end).toBe(5);
    });
  });

  describe('resolveConflict', () => {
    it('should auto-resolve simple addition (ours empty)', () => {
      const conflict = makeConflict({
        oursContent: '',
        theirsContent: 'const newFeature = true;',
      });

      const result = resolver.resolveConflict(conflict);
      expect(result.resolution).toBe('merged');
      expect(result.resolvedContent).toBe('const newFeature = true;');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should auto-resolve simple addition (theirs empty)', () => {
      const conflict = makeConflict({
        oursContent: 'const ourCode = 1;',
        theirsContent: '  ',
      });

      const result = resolver.resolveConflict(conflict);
      expect(result.resolution).toBe('merged');
      expect(result.resolvedContent).toBe('const ourCode = 1;');
    });

    it('should auto-resolve non-overlapping changes', () => {
      const conflict = makeConflict({
        oursContent: 'const a = 1;',
        theirsContent: 'const b = 2;',
      });

      const result = resolver.resolveConflict(conflict);
      expect(result.resolution).toBe('merged');
      expect(result.resolvedContent).toContain('const a = 1;');
      expect(result.resolvedContent).toContain('const b = 2;');
    });

    it('should resolve identical content with high confidence', () => {
      const conflict = makeConflict({
        oursContent: 'const x = 42;',
        theirsContent: 'const x = 42;',
      });

      const result = resolver.resolveConflict(conflict);
      expect(result.resolution).toBe('merged');
      expect(result.confidence).toBe(1.0);
    });

    it('should mark binary conflicts as manual', () => {
      const conflict = makeConflict({ conflictType: 'binary' });

      const result = resolver.resolveConflict(conflict);
      expect(result.resolution).toBe('manual');
      expect(result.confidence).toBe(0);
    });

    it('should fall back to manual for overlapping content changes', () => {
      const noAutoResolver = new ConflictResolver(makeConfig({ autoResolveConflicts: false }));
      const conflict = makeConflict({
        oursContent: 'const x = 1;\nconst shared = true;',
        theirsContent: 'const x = 2;\nconst shared = true;',
      });

      const result = noAutoResolver.resolveConflict(conflict);
      expect(result.resolution).toBe('manual');
    });

    it('should respect confidence threshold', () => {
      const strictResolver = new ConflictResolver(
        makeConfig({ autoResolveConflicts: true, conflictConfidenceThreshold: 0.99 }),
      );
      const conflict = makeConflict({
        oursContent: 'const a = 1;',
        theirsContent: 'const b = 2;',
      });

      const result = strictResolver.resolveConflict(conflict);
      // With 0.99 threshold, auto-merge should fail and fall back to manual
      expect(result.resolution).toBe('manual');
    });
  });

  describe('resolveAll', () => {
    it('should resolve multiple conflicts', () => {
      const conflicts = [
        makeConflict({ filePath: 'a.ts', oursContent: '', theirsContent: 'new code' }),
        makeConflict({ filePath: 'b.ts', oursContent: 'const x = 42;', theirsContent: 'const x = 42;' }),
        makeConflict({ filePath: 'c.ts', conflictType: 'binary' }),
      ];

      const results = resolver.resolveAll(conflicts);
      expect(results).toHaveLength(3);
      expect(results[0].resolution).toBe('merged');
      expect(results[1].resolution).toBe('merged');
      expect(results[2].resolution).toBe('manual');
    });

    it('should preserve file paths in results', () => {
      const conflicts = [
        makeConflict({ filePath: 'src/a.ts' }),
        makeConflict({ filePath: 'src/b.ts' }),
      ];

      const results = resolver.resolveAll(conflicts);
      expect(results[0].filePath).toBe('src/a.ts');
      expect(results[1].filePath).toBe('src/b.ts');
    });
  });
});

// ============================================================================
// PRReviewer
// ============================================================================

describe('PRReviewer', () => {
  let reviewer: PRReviewer;

  beforeEach(() => {
    reviewer = new PRReviewer(makeConfig());
  });

  describe('review with clean files', () => {
    it('should approve clean small changes', () => {
      const result = reviewer.review({
        title: 'Add utility function',
        body: 'Small helper',
        files: [
          makePRFile({ path: 'src/utils.ts', additions: 10, deletions: 2 }),
          makePRFile({ path: 'tests/utils.test.ts', additions: 15, deletions: 0 }),
        ],
      });

      expect(result.decision).toBe('approve');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('file size checks', () => {
    it('should warn about large file changes', () => {
      const result = reviewer.review({
        title: 'Major rewrite',
        body: 'Complete rewrite',
        files: [
          makePRFile({ path: 'src/big-file.ts', additions: 600, deletions: 100 }),
          makePRFile({ path: 'tests/big-file.test.ts', additions: 10, deletions: 0 }),
        ],
      });

      const sizeComments = result.comments.filter((c) =>
        c.body.includes('Large file change'),
      );
      expect(sizeComments.length).toBeGreaterThan(0);
      expect(sizeComments[0].severity).toBe('warning');
    });
  });

  describe('sensitive file checks', () => {
    it('should flag .env files as errors', () => {
      const result = reviewer.review({
        title: 'Update config',
        body: 'Configuration update',
        files: [makePRFile({ path: '.env', additions: 3, deletions: 1 })],
      });

      const sensitiveComments = result.comments.filter((c) =>
        c.body.includes('Sensitive file'),
      );
      expect(sensitiveComments.length).toBeGreaterThan(0);
      expect(sensitiveComments[0].severity).toBe('error');
    });

    it('should flag secrets files as errors', () => {
      const result = reviewer.review({
        title: 'Update secrets',
        body: 'Rotate keys',
        files: [makePRFile({ path: 'config/secrets.json', additions: 5, deletions: 5 })],
      });

      const sensitiveComments = result.comments.filter((c) =>
        c.body.includes('Sensitive file'),
      );
      expect(sensitiveComments.length).toBeGreaterThan(0);
    });

    it('should flag credential files as errors', () => {
      const result = reviewer.review({
        title: 'Add credential',
        body: 'New credentials',
        files: [makePRFile({ path: 'credentials.json', additions: 10, deletions: 0 })],
      });

      expect(result.comments.some((c) => c.severity === 'error')).toBe(true);
    });

    it('should flag .pem and .key files as errors', () => {
      const result = reviewer.review({
        title: 'Update certs',
        body: 'New SSL cert',
        files: [makePRFile({ path: 'certs/server.pem', additions: 30, deletions: 30 })],
      });

      expect(result.comments.some((c) => c.severity === 'error')).toBe(true);
    });
  });

  describe('test coverage checks', () => {
    it('should warn when source changes lack tests', () => {
      const result = reviewer.review({
        title: 'Add feature',
        body: 'New feature without tests',
        files: [makePRFile({ path: 'src/feature.ts', additions: 50, deletions: 0 })],
      });

      const testComments = result.comments.filter((c) =>
        c.body.includes('test'),
      );
      expect(testComments.length).toBeGreaterThan(0);
    });

    it('should not warn when tests are included', () => {
      const result = reviewer.review({
        title: 'Add feature',
        body: 'Feature with tests',
        files: [
          makePRFile({ path: 'src/feature.ts', additions: 30, deletions: 0 }),
          makePRFile({ path: 'tests/feature.test.ts', additions: 50, deletions: 0 }),
        ],
      });

      const testComments = result.comments.filter((c) =>
        c.body.toLowerCase().includes('no test files'),
      );
      expect(testComments).toHaveLength(0);
    });

    it('should not require tests in lenient mode', () => {
      const lenientReviewer = new PRReviewer(makeConfig({ reviewStrictness: 'lenient' }));
      const result = lenientReviewer.review({
        title: 'Quick change',
        body: 'Small update',
        files: [makePRFile({ path: 'src/feature.ts', additions: 5, deletions: 1 })],
      });

      const testComments = result.comments.filter((c) =>
        c.body.toLowerCase().includes('test'),
      );
      expect(testComments).toHaveLength(0);
    });
  });

  describe('score calculation', () => {
    it('should start at 100 for no issues', () => {
      const result = reviewer.review({
        title: 'Clean PR',
        body: 'All good',
        files: [
          makePRFile({ path: 'src/clean.ts', additions: 5, deletions: 2 }),
          makePRFile({ path: 'tests/clean.test.ts', additions: 10, deletions: 0 }),
        ],
      });

      expect(result.score).toBe(100);
    });

    it('should deduct 20 per error', () => {
      const result = reviewer.review({
        title: 'With env',
        body: 'Has sensitive file',
        files: [
          makePRFile({ path: '.env', additions: 1, deletions: 0 }),
          makePRFile({ path: 'tests/a.test.ts', additions: 1, deletions: 0 }),
        ],
      });

      // 100 - 20 (error for .env) = 80
      expect(result.score).toBe(80);
    });

    it('should deduct 10 per warning', () => {
      const result = reviewer.review({
        title: 'Big change',
        body: 'Large files',
        files: [
          makePRFile({ path: 'src/big.ts', additions: 600, deletions: 0 }),
          makePRFile({ path: 'tests/big.test.ts', additions: 1, deletions: 0 }),
        ],
      });

      // 100 - 10 (warning for large file) = 90
      expect(result.score).toBe(90);
    });

    it('should not go below 0', () => {
      const result = reviewer.review({
        title: 'Disaster',
        body: 'Many problems',
        files: [
          makePRFile({ path: '.env', additions: 1, deletions: 0 }),
          makePRFile({ path: 'secrets.json', additions: 1, deletions: 0 }),
          makePRFile({ path: 'credentials.json', additions: 1, deletions: 0 }),
          makePRFile({ path: 'private.key', additions: 1, deletions: 0 }),
          makePRFile({ path: 'password.txt', additions: 1, deletions: 0 }),
          makePRFile({ path: 'token.json', additions: 1, deletions: 0 }),
        ],
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('decision mapping', () => {
    it('should approve when score >= approveMinScore', () => {
      const result = reviewer.review({
        title: 'Clean',
        body: '',
        files: [
          makePRFile({ path: 'src/x.ts', additions: 5, deletions: 1 }),
          makePRFile({ path: 'tests/x.test.ts', additions: 5, deletions: 0 }),
        ],
      });

      expect(result.decision).toBe('approve');
    });

    it('should request-changes when errors are present', () => {
      const result = reviewer.review({
        title: 'Bad PR',
        body: '',
        files: [makePRFile({ path: '.env', additions: 10, deletions: 0 })],
      });

      expect(result.decision).toBe('request-changes');
    });

    it('should comment when score is in middle range', () => {
      // To get 'comment': need score between 41-69 with NO errors (errors force request-changes).
      // Use warnings only: large files + no tests.
      // 4 large files (4 warnings * 10 = 40 deduction) + 1 no-test warning = 50 deduction -> score 50
      const result = reviewer.review({
        title: 'Multiple large files',
        body: '',
        files: [
          makePRFile({ path: 'src/a.ts', additions: 600, deletions: 0 }),
          makePRFile({ path: 'src/b.ts', additions: 600, deletions: 0 }),
          makePRFile({ path: 'src/c.ts', additions: 600, deletions: 0 }),
          makePRFile({ path: 'src/d.ts', additions: 600, deletions: 0 }),
        ],
      });

      // 100 - 10*4 (large files) - 10 (no tests) = 50
      expect(result.score).toBe(50);
      expect(result.decision).toBe('comment');
    });
  });

  describe('risk assessment', () => {
    it('should assess low risk for small changes', () => {
      const result = reviewer.review({
        title: 'Small change',
        body: '',
        files: [
          makePRFile({ path: 'src/x.ts', additions: 5, deletions: 2 }),
          makePRFile({ path: 'tests/x.test.ts', additions: 5, deletions: 0 }),
        ],
      });

      expect(result.riskLevel).toBe('low');
    });

    it('should assess high risk for sensitive files', () => {
      const result = reviewer.review({
        title: 'Config update',
        body: '',
        files: [makePRFile({ path: '.env.production', additions: 2, deletions: 1 })],
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should assess high risk for large total changes', () => {
      const result = reviewer.review({
        title: 'Major rewrite',
        body: '',
        files: [
          makePRFile({ path: 'src/a.ts', additions: 400, deletions: 300 }),
          makePRFile({ path: 'src/b.ts', additions: 200, deletions: 200 }),
        ],
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should assess medium risk for moderate changes', () => {
      const result = reviewer.review({
        title: 'Moderate update',
        body: '',
        files: [
          makePRFile({ path: 'src/a.ts', additions: 100, deletions: 50 }),
          makePRFile({ path: 'src/b.ts', additions: 80, deletions: 80 }),
          makePRFile({ path: 'tests/a.test.ts', additions: 20, deletions: 5 }),
        ],
      });

      expect(result.riskLevel).toBe('medium');
    });
  });

  describe('strictness levels', () => {
    it('should be more lenient with lenient strictness', () => {
      const lenientReviewer = new PRReviewer(makeConfig({ reviewStrictness: 'lenient' }));
      const result = lenientReviewer.review({
        title: 'Feature',
        body: '',
        files: [makePRFile({ path: 'src/x.ts', additions: 50, deletions: 10 })],
      });

      // Lenient: no test required, higher file size threshold, lower approve threshold
      expect(result.decision).toBe('approve');
    });

    it('should be stricter with strict strictness', () => {
      const strictReviewer = new PRReviewer(makeConfig({ reviewStrictness: 'strict' }));
      const result = strictReviewer.review({
        title: 'Feature',
        body: '',
        files: [
          makePRFile({ path: 'src/x.ts', additions: 400, deletions: 10 }),
        ],
      });

      // Strict: requires tests (warning), file size 300 threshold (warning)
      // Score: 100 - 10 (no tests) - 10 (large file) = 80, approve threshold is 85
      expect(result.decision).not.toBe('approve');
    });
  });

  describe('summary generation', () => {
    it('should include score and risk in summary', () => {
      const result = reviewer.review({
        title: 'PR',
        body: '',
        files: [
          makePRFile({ path: 'src/x.ts', additions: 5, deletions: 1 }),
          makePRFile({ path: 'tests/x.test.ts', additions: 5, deletions: 0 }),
        ],
      });

      expect(result.summary).toContain('Score:');
      expect(result.summary).toContain('Risk:');
    });

    it('should mention errors and warnings in summary', () => {
      const result = reviewer.review({
        title: 'Issues',
        body: '',
        files: [makePRFile({ path: '.env', additions: 1, deletions: 0 })],
      });

      expect(result.summary).toContain('error');
    });
  });
});

// ============================================================================
// Integration
// ============================================================================

describe('Git Workflow Integration', () => {
  it('should complete full workflow: description -> branch -> PR -> review', () => {
    const config = makeConfig({ autoResolveConflicts: true });
    const strategist = new BranchStrategist(config);
    const resolver = new ConflictResolver(config);
    const reviewer = new PRReviewer(config);

    // Step 1: Determine branch strategy
    const recommendation = strategist.recommend(
      'Add user authentication with JWT',
      ['src/auth/jwt.ts', 'src/auth/middleware.ts'],
    );
    expect(recommendation.strategy).toBe('feature');
    expect(recommendation.branchName).toContain('feature/');

    // Step 2: Resolve any conflicts (simulate)
    const conflictContent = [
      '<<<<<<< HEAD',
      'import { oldAuth } from "./auth";',
      '=======',
      'import { newAuth } from "./jwt-auth";',
      '>>>>>>> feature/add-user-authentication',
    ].join('\n');

    const conflicts = resolver.parseConflicts(conflictContent, 'src/index.ts');
    expect(conflicts).toHaveLength(1);

    const resolutions = resolver.resolveAll(conflicts);
    expect(resolutions).toHaveLength(1);

    // Step 3: Review the PR
    const reviewResult: PRReviewResult = reviewer.review({
      title: 'Add JWT authentication',
      body: 'Implements JWT auth with middleware',
      files: [
        { path: 'src/auth/jwt.ts', additions: 80, deletions: 0, status: 'added' },
        { path: 'src/auth/middleware.ts', additions: 45, deletions: 0, status: 'added' },
        { path: 'tests/auth/jwt.test.ts', additions: 120, deletions: 0, status: 'added' },
      ],
    });

    expect(reviewResult.decision).toBe('approve');
    expect(reviewResult.score).toBeGreaterThanOrEqual(70);
    expect(reviewResult.riskLevel).toBe('low');
  });

  it('should flag risky workflow with sensitive files', () => {
    const config = makeConfig();
    const strategist = new BranchStrategist(config);
    const reviewer = new PRReviewer(config);

    const recommendation = strategist.recommend('Hotfix: update API tokens');
    expect(recommendation.strategy).toBe('hotfix');

    const reviewResult = reviewer.review({
      title: 'Update API tokens',
      body: 'Rotate expired tokens',
      files: [
        { path: 'config/tokens.json', additions: 5, deletions: 5, status: 'modified' },
        { path: '.env.production', additions: 2, deletions: 2, status: 'modified' },
      ],
    });

    expect(reviewResult.riskLevel).toBe('high');
    expect(reviewResult.comments.some((c) => c.severity === 'error')).toBe(true);
  });
});

/**
 * Comment Checker Hook Tests
 *
 * Feature: F3.15 - Comment Checker
 */

import * as fs from 'fs';
import {
  CommentCheckerHook,
  createCommentChecker,
  CommentType,
  CommentIssueType,
  CommentIssueSeverity,
  SupportedLanguage,
  type CommentCheckerConfig,
  type CommentCheckResult,
  LANGUAGE_PATTERNS,
  EXTENSION_TO_LANGUAGE,
  DEFAULT_COMMENT_CHECKER_CONFIG,
  DEFAULT_SEVERITY_MAP,
} from '../../../../../src/core/hooks/comment-checker';
import { HookEvent, HookContext, HookAction } from '../../../../../src/core/interfaces/hook.interface';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('CommentCheckerHook', () => {
  let hook: CommentCheckerHook;

  beforeEach(() => {
    hook = new CommentCheckerHook();
    jest.clearAllMocks();
  });

  afterEach(() => {
    hook.dispose();
  });

  describe('Factory Function', () => {
    it('should create instance via createCommentChecker', () => {
      const checker = createCommentChecker();
      expect(checker).toBeInstanceOf(CommentCheckerHook);
      checker.dispose();
    });

    it('should create instance with custom config', () => {
      const config: CommentCheckerConfig = {
        maxCommentRatio: 0.3,
        maxConsecutiveCommentLines: 10,
      };
      const checker = createCommentChecker(config);
      expect(checker).toBeInstanceOf(CommentCheckerHook);
      checker.dispose();
    });
  });

  describe('Hook Properties', () => {
    it('should have correct name', () => {
      expect(hook.name).toBe('comment-checker');
    });

    it('should have correct description', () => {
      expect(hook.description).toBe('Detects excessive and problematic comments');
    });

    it('should have correct event', () => {
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
    });

    it('should use default priority', () => {
      expect(hook.priority).toBe(DEFAULT_COMMENT_CHECKER_CONFIG.priority);
    });

    it('should be enabled by default', () => {
      expect(hook.isEnabled()).toBe(true);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript', () => {
      expect(hook.detectLanguage('file.ts')).toBe(SupportedLanguage.TYPESCRIPT);
      expect(hook.detectLanguage('file.tsx')).toBe(SupportedLanguage.TYPESCRIPT);
    });

    it('should detect JavaScript', () => {
      expect(hook.detectLanguage('file.js')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(hook.detectLanguage('file.jsx')).toBe(SupportedLanguage.JAVASCRIPT);
      expect(hook.detectLanguage('file.mjs')).toBe(SupportedLanguage.JAVASCRIPT);
    });

    it('should detect Python', () => {
      expect(hook.detectLanguage('file.py')).toBe(SupportedLanguage.PYTHON);
      expect(hook.detectLanguage('file.pyw')).toBe(SupportedLanguage.PYTHON);
    });

    it('should detect Java', () => {
      expect(hook.detectLanguage('file.java')).toBe(SupportedLanguage.JAVA);
    });

    it('should detect Go', () => {
      expect(hook.detectLanguage('file.go')).toBe(SupportedLanguage.GO);
    });

    it('should detect Rust', () => {
      expect(hook.detectLanguage('file.rs')).toBe(SupportedLanguage.RUST);
    });

    it('should detect C/C++', () => {
      expect(hook.detectLanguage('file.c')).toBe(SupportedLanguage.C);
      expect(hook.detectLanguage('file.h')).toBe(SupportedLanguage.C);
      expect(hook.detectLanguage('file.cpp')).toBe(SupportedLanguage.CPP);
      expect(hook.detectLanguage('file.hpp')).toBe(SupportedLanguage.CPP);
    });

    it('should detect C#', () => {
      expect(hook.detectLanguage('file.cs')).toBe(SupportedLanguage.CSHARP);
    });

    it('should detect Ruby', () => {
      expect(hook.detectLanguage('file.rb')).toBe(SupportedLanguage.RUBY);
    });

    it('should detect PHP', () => {
      expect(hook.detectLanguage('file.php')).toBe(SupportedLanguage.PHP);
    });

    it('should detect Shell', () => {
      expect(hook.detectLanguage('file.sh')).toBe(SupportedLanguage.SHELL);
      expect(hook.detectLanguage('file.bash')).toBe(SupportedLanguage.SHELL);
    });

    it('should detect YAML', () => {
      expect(hook.detectLanguage('file.yaml')).toBe(SupportedLanguage.YAML);
      expect(hook.detectLanguage('file.yml')).toBe(SupportedLanguage.YAML);
    });

    it('should return UNKNOWN for unsupported extensions', () => {
      expect(hook.detectLanguage('file.xyz')).toBe(SupportedLanguage.UNKNOWN);
      expect(hook.detectLanguage('file')).toBe(SupportedLanguage.UNKNOWN);
    });
  });

  describe('Comment Parsing - Single Line', () => {
    it('should parse JavaScript single-line comments', () => {
      const content = `
const x = 1;
// This is a comment
const y = 2;
`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.SINGLE_LINE);
      expect(comments[0].content).toBe('This is a comment');
    });

    it('should parse Python comments', () => {
      const content = `
x = 1
# This is a comment
y = 2
`;
      const comments = hook.parseComments(content, SupportedLanguage.PYTHON);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.SINGLE_LINE);
      expect(comments[0].content).toBe('This is a comment');
    });

    it('should parse inline comments', () => {
      const content = `const x = 1; // inline comment`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.INLINE);
      expect(comments[0].associatedCode).toBe('const x = 1;');
    });

    it('should not parse comments inside strings', () => {
      const content = `const str = "// not a comment";`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(0);
    });
  });

  describe('Comment Parsing - Multi Line', () => {
    it('should parse multi-line comments', () => {
      const content = `
/*
 * This is a multi-line comment
 * with multiple lines
 */
const x = 1;
`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.MULTI_LINE);
    });

    it('should parse single-line block comments', () => {
      const content = `/* single line block */`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.MULTI_LINE);
    });
  });

  describe('Comment Parsing - Doc Comments', () => {
    it('should parse JSDoc comments', () => {
      const content = `
/**
 * This is a JSDoc comment
 * @param x The parameter
 */
function foo(x) {}
`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.DOC_COMMENT);
    });
  });

  describe('Comment Parsing - TODO Comments', () => {
    it('should identify TODO comments', () => {
      const content = `// TODO: Fix this`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.TODO);
    });

    it('should identify FIXME comments', () => {
      const content = `// FIXME: This is broken`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.TODO);
    });

    it('should identify HACK comments', () => {
      const content = `// HACK: Temporary workaround`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.TODO);
    });
  });

  describe('Comment Parsing - License Comments', () => {
    it('should identify license comments', () => {
      const content = `// Copyright (c) 2024 Company Name`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.LICENSE);
    });

    it('should identify MIT license comments', () => {
      const content = `// MIT License`;
      const comments = hook.parseComments(content, SupportedLanguage.JAVASCRIPT);
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(CommentType.LICENSE);
    });
  });

  describe('Issue Detection - Trivial Comments', () => {
    it('should detect empty comments', async () => {
      const content = `
//
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const trivialIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.TRIVIAL
      );
      expect(trivialIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Issue Detection - Commented Code', () => {
    it('should detect commented-out variable declarations', async () => {
      const content = `
// const x = 1;
const y = 2;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const codeIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.COMMENTED_CODE
      );
      expect(codeIssues.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect commented-out function calls', async () => {
      const content = `
// obj.method();
const y = 2;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const codeIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.COMMENTED_CODE
      );
      expect(codeIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Issue Detection - Verbose Comments', () => {
    it('should detect verbose comments', async () => {
      const longComment = 'a'.repeat(250);
      const content = `
// ${longComment}
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const verboseIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.VERBOSE
      );
      expect(verboseIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Issue Detection - High Density', () => {
    it('should detect high comment density', async () => {
      const content = `
// Comment 1
// Comment 2
// Comment 3
// Comment 4
// Comment 5
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const checker = createCommentChecker({ maxCommentDensity: 0.1 });
      const result = await checker.analyzeFile('test.js');
      const densityIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.HIGH_DENSITY
      );
      expect(densityIssues.length).toBeGreaterThanOrEqual(1);
      checker.dispose();
    });
  });

  describe('Issue Detection - Redundant Comments', () => {
    it('should detect redundant increment comments', async () => {
      const content = `
// increment x
x++;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const redundantIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.REDUNDANT
      );
      expect(redundantIssues.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect redundant return comments', async () => {
      const content = `
// return the value
return result;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const redundantIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.REDUNDANT
      );
      expect(redundantIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Issue Detection - Untracked TODO', () => {
    it('should detect TODO without ticket when required', async () => {
      const content = `
// TODO: Fix this bug
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const checker = createCommentChecker({ requireTicketForTodo: true });
      const result = await checker.analyzeFile('test.js');
      const todoIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.UNTRACKED_TODO
      );
      expect(todoIssues.length).toBeGreaterThanOrEqual(1);
      checker.dispose();
    });

    it('should not flag TODO with JIRA ticket', async () => {
      const content = `
// TODO: JIRA-123 Fix this bug
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const checker = createCommentChecker({ requireTicketForTodo: true });
      const result = await checker.analyzeFile('test.js');
      const todoIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.UNTRACKED_TODO
      );
      expect(todoIssues).toHaveLength(0);
      checker.dispose();
    });

    it('should not flag TODO with GitHub issue reference', async () => {
      const content = `
// TODO: #456 Fix this bug
const x = 1;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const checker = createCommentChecker({ requireTicketForTodo: true });
      const result = await checker.analyzeFile('test.js');
      const todoIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.UNTRACKED_TODO
      );
      expect(todoIssues).toHaveLength(0);
      checker.dispose();
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate comment statistics', async () => {
      const content = `
// Comment 1
const x = 1;
// Comment 2
const y = 2;
/* Block
   comment */
const z = 3;
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      expect(result.statistics.totalComments).toBe(3);
      expect(result.statistics.totalCodeLines).toBeGreaterThan(0);
      expect(result.statistics.commentDensity).toBeGreaterThan(0);
    });

    it('should track comments by type', async () => {
      const content = `
// Single line
/* Block */
/** Doc */
`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      expect(result.statistics.byType[CommentType.SINGLE_LINE]).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Analyze Multiple Files', () => {
    it('should analyze multiple files', async () => {
      (mockFs.promises.readFile as jest.Mock)
        .mockResolvedValueOnce('// File 1 comment\nconst x = 1;')
        .mockResolvedValueOnce('// File 2 comment\nconst y = 2;');

      const result = await hook.analyze(['file1.js', 'file2.js']);
      expect(result.filesAnalyzed).toBe(2);
    });

    it('should continue on file read errors', async () => {
      (mockFs.promises.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('// Comment\nconst x = 1;');

      const result = await hook.analyze(['missing.js', 'existing.js']);
      expect(result.filesAnalyzed).toBe(2);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track metrics', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment\nconst x = 1;');

      await hook.analyze(['test.js']);
      const metrics = hook.getMetrics();

      expect(metrics.totalChecks).toBe(1);
      expect(metrics.totalFilesAnalyzed).toBe(1);
      expect(metrics.totalCommentsAnalyzed).toBeGreaterThanOrEqual(1);
    });

    it('should reset metrics', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment\nconst x = 1;');

      await hook.analyze(['test.js']);
      hook.resetMetrics();
      const metrics = hook.getMetrics();

      expect(metrics.totalChecks).toBe(0);
      expect(metrics.totalFilesAnalyzed).toBe(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should emit check started event', async () => {
      const callback = jest.fn();
      const sub = hook.onCheckStarted(callback);

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment');
      await hook.analyze(['test.js']);

      expect(callback).toHaveBeenCalledWith(['test.js']);
      sub.unsubscribe();
    });

    it('should emit check completed event', async () => {
      const callback = jest.fn();
      const sub = hook.onCheckCompleted(callback);

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment');
      await hook.analyze(['test.js']);

      expect(callback).toHaveBeenCalled();
      const result = callback.mock.calls[0][0] as CommentCheckResult;
      expect(result.filesAnalyzed).toBe(1);
      sub.unsubscribe();
    });

    it('should emit issue found event', async () => {
      const callback = jest.fn();
      const sub = hook.onIssueFound(callback);

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('//\nconst x = 1;');
      await hook.analyze(['test.js']);

      expect(callback).toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('should emit file analyzed event', async () => {
      const callback = jest.fn();
      const sub = hook.onFileAnalyzed(callback);

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment');
      await hook.analyze(['test.js']);

      expect(callback).toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('should unsubscribe from events', async () => {
      const callback = jest.fn();
      const sub = hook.onCheckStarted(callback);
      sub.unsubscribe();

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment');
      await hook.analyze(['test.js']);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Hook Execution', () => {
    it('should execute hook with files in context', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment\nconst x = 1;');

      const context: HookContext = {
        event: HookEvent.TASK_BEFORE,
        timestamp: new Date(),
        source: 'test',
        data: { files: ['test.js'] },
      };

      const result = await hook.execute(context);
      expect(result.action).toBe(HookAction.CONTINUE);
    });

    it('should continue with empty files', async () => {
      const context: HookContext = {
        event: HookEvent.TASK_BEFORE,
        timestamp: new Date(),
        source: 'test',
        data: { files: [] },
      };

      const result = await hook.execute(context);
      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.message).toBe('No files to check');
    });

    it('should abort when disposed', async () => {
      hook.dispose();

      const context: HookContext = {
        event: HookEvent.TASK_BEFORE,
        timestamp: new Date(),
        source: 'test',
        data: { files: ['test.js'] },
      };

      const result = await hook.execute(context);
      expect(result.action).toBe(HookAction.ABORT);
    });
  });

  describe('Auto Fix', () => {
    it('should fix trivial comments when enabled', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('//\nconst x = 1;');
      (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const checker = createCommentChecker({
        autoFix: { removeTrivial: true },
      });

      const result = await checker.fix(['test.js']);
      expect(result.totalFixed).toBeGreaterThan(0);
      checker.dispose();
    });

    it('should not fix in dry run mode', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('//\nconst x = 1;');

      const checker = createCommentChecker({
        autoFix: { removeTrivial: true, dryRun: true },
      });

      await checker.fix(['test.js']);
      expect(mockFs.promises.writeFile).not.toHaveBeenCalled();
      checker.dispose();
    });

    it('should create backup when enabled', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('//\nconst x = 1;');
      (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const checker = createCommentChecker({
        autoFix: { removeTrivial: true, createBackup: true },
      });

      await checker.fix(['test.js']);
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        'test.js.bak',
        expect.any(String)
      );
      checker.dispose();
    });
  });

  describe('Configuration', () => {
    it('should use custom severity overrides', async () => {
      const checker = createCommentChecker({
        severityOverrides: {
          [CommentIssueType.TRIVIAL]: CommentIssueSeverity.ERROR,
        },
      });

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('//\nconst x = 1;');
      const result = await checker.analyzeFile('test.js');

      const trivialIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.TRIVIAL
      );
      if (trivialIssues.length > 0) {
        expect(trivialIssues[0].severity).toBe(CommentIssueSeverity.ERROR);
      }
      checker.dispose();
    });

    it('should use custom verbose threshold', async () => {
      const shortThreshold = 50;
      const checker = createCommentChecker({
        verboseCommentThreshold: shortThreshold,
      });

      const comment = 'a'.repeat(shortThreshold + 10);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(`// ${comment}`);
      const result = await checker.analyzeFile('test.js');

      const verboseIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.VERBOSE
      );
      expect(verboseIssues.length).toBeGreaterThanOrEqual(1);
      checker.dispose();
    });

    it('should respect checkRedundant flag', async () => {
      const checker = createCommentChecker({ checkRedundant: false });

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// increment x\nx++;');
      const result = await checker.analyzeFile('test.js');

      const redundantIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.REDUNDANT
      );
      expect(redundantIssues).toHaveLength(0);
      checker.dispose();
    });

    it('should respect checkCommentedCode flag', async () => {
      const checker = createCommentChecker({ checkCommentedCode: false });

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// const x = 1;');
      const result = await checker.analyzeFile('test.js');

      const codeIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.COMMENTED_CODE
      );
      expect(codeIssues).toHaveLength(0);
      checker.dispose();
    });
  });

  describe('Enable/Disable', () => {
    it('should be disableable', () => {
      hook.disable();
      expect(hook.isEnabled()).toBe(false);
    });

    it('should be re-enableable', () => {
      hook.disable();
      hook.enable();
      expect(hook.isEnabled()).toBe(true);
    });

    it('should not run when disabled', () => {
      hook.disable();
      const context: HookContext = {
        event: HookEvent.TASK_BEFORE,
        timestamp: new Date(),
        source: 'test',
        data: {},
      };
      expect(hook.shouldRun(context)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have language patterns for all supported languages', () => {
      for (const lang of Object.values(SupportedLanguage)) {
        expect(LANGUAGE_PATTERNS[lang]).toBeDefined();
        expect(LANGUAGE_PATTERNS[lang].singleLine).toBeDefined();
      }
    });

    it('should have extension mappings', () => {
      expect(EXTENSION_TO_LANGUAGE['.ts']).toBe(SupportedLanguage.TYPESCRIPT);
      expect(EXTENSION_TO_LANGUAGE['.py']).toBe(SupportedLanguage.PYTHON);
      expect(EXTENSION_TO_LANGUAGE['.java']).toBe(SupportedLanguage.JAVA);
    });

    it('should have default severity map', () => {
      for (const issueType of Object.values(CommentIssueType)) {
        expect(DEFAULT_SEVERITY_MAP[issueType]).toBeDefined();
      }
    });
  });

  describe('Excessive Block Detection', () => {
    it('should detect excessive consecutive comment lines', async () => {
      const comments = Array(25).fill('// Comment line').join('\n');
      const content = `${comments}\nconst x = 1;`;
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(content);

      const result = await hook.analyzeFile('test.js');
      const blockIssues = result.issues.filter(
        (i) => i.type === CommentIssueType.EXCESSIVE_BLOCK
      );
      expect(blockIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Get Statistics', () => {
    it('should get statistics for a file', async () => {
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('// Comment\nconst x = 1;');

      const stats = await hook.getStatistics('test.js');
      expect(stats.totalComments).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Get Config', () => {
    it('should return hook configuration', () => {
      const config = hook.getConfig();
      expect(config.name).toBe('comment-checker');
      expect(config.event).toBe(HookEvent.TASK_BEFORE);
      expect(config.enabled).toBe(true);
    });
  });
});

describe('CommentType Enum', () => {
  it('should have all comment types', () => {
    expect(CommentType.SINGLE_LINE).toBe('single_line');
    expect(CommentType.MULTI_LINE).toBe('multi_line');
    expect(CommentType.DOC_COMMENT).toBe('doc_comment');
    expect(CommentType.TODO).toBe('todo');
    expect(CommentType.LICENSE).toBe('license');
    expect(CommentType.INLINE).toBe('inline');
  });
});

describe('CommentIssueType Enum', () => {
  it('should have all issue types', () => {
    expect(CommentIssueType.REDUNDANT).toBe('redundant');
    expect(CommentIssueType.VERBOSE).toBe('verbose');
    expect(CommentIssueType.OUTDATED).toBe('outdated');
    expect(CommentIssueType.EXCESSIVE_BLOCK).toBe('excessive_block');
    expect(CommentIssueType.HIGH_DENSITY).toBe('high_density');
    expect(CommentIssueType.TRIVIAL).toBe('trivial');
    expect(CommentIssueType.COMMENTED_CODE).toBe('commented_code');
    expect(CommentIssueType.NONSTANDARD_FORMAT).toBe('nonstandard_format');
    expect(CommentIssueType.MISSING_DOC).toBe('missing_doc');
    expect(CommentIssueType.UNTRACKED_TODO).toBe('untracked_todo');
  });
});

describe('CommentIssueSeverity Enum', () => {
  it('should have all severity levels', () => {
    expect(CommentIssueSeverity.ERROR).toBe('error');
    expect(CommentIssueSeverity.WARNING).toBe('warning');
    expect(CommentIssueSeverity.INFO).toBe('info');
    expect(CommentIssueSeverity.SUGGESTION).toBe('suggestion');
  });
});

describe('SupportedLanguage Enum', () => {
  it('should have all supported languages', () => {
    expect(SupportedLanguage.TYPESCRIPT).toBe('typescript');
    expect(SupportedLanguage.JAVASCRIPT).toBe('javascript');
    expect(SupportedLanguage.PYTHON).toBe('python');
    expect(SupportedLanguage.JAVA).toBe('java');
    expect(SupportedLanguage.GO).toBe('go');
    expect(SupportedLanguage.RUST).toBe('rust');
    expect(SupportedLanguage.C).toBe('c');
    expect(SupportedLanguage.CPP).toBe('cpp');
    expect(SupportedLanguage.CSHARP).toBe('csharp');
    expect(SupportedLanguage.RUBY).toBe('ruby');
    expect(SupportedLanguage.PHP).toBe('php');
    expect(SupportedLanguage.SHELL).toBe('shell');
    expect(SupportedLanguage.YAML).toBe('yaml');
    expect(SupportedLanguage.UNKNOWN).toBe('unknown');
  });
});

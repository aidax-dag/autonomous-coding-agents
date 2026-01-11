/**
 * Todo Enforcer Hook Tests
 *
 * Feature: F3.17 - Todo Enforcer
 */

import {
  TodoEnforcerHook,
  createTodoEnforcer,
  TodoType,
  TodoPriority,
  EnforcementLevel,
  TodoSupportedLanguage,
  TodoEnforcerConfig,
  TodoEnforcementRule,
  EnforcementViolation,
  DEFAULT_ENFORCEMENT_RULES,
} from '../../../../../src/core/hooks/todo-enforcer/index.js';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

import * as fs from 'fs';

const mockReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;

describe('TodoEnforcerHook', () => {
  let enforcer: TodoEnforcerHook;

  beforeEach(() => {
    jest.clearAllMocks();
    enforcer = createTodoEnforcer();
  });

  afterEach(() => {
    enforcer.dispose();
  });

  describe('Constructor', () => {
    it('should create with default configuration', () => {
      const hook = createTodoEnforcer();
      expect(hook.name).toBe('todo-enforcer');
      expect(hook.description).toBe('Detects and enforces TODO completion in code');
      expect(hook.isEnabled()).toBe(true);
      hook.dispose();
    });

    it('should create with custom configuration', () => {
      const config: TodoEnforcerConfig = {
        enabled: false,
        maxTodos: 50,
        maxAgeDays: 30,
        requireAssignee: true,
        blockCommits: true,
      };
      const hook = createTodoEnforcer(config);
      expect(hook.isEnabled()).toBe(false);
      hook.dispose();
    });

    it('should load default enforcement rules', () => {
      const rules = enforcer.getRules();
      expect(rules.length).toBe(DEFAULT_ENFORCEMENT_RULES.length);
    });
  });

  describe('analyzeFile', () => {
    it('should detect TODO comments in TypeScript files', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO: Fix this later
        function test() {
          // TODO @john: Implement validation
          return true;
        }
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.file).toBe('test.ts');
      expect(result.language).toBe(TodoSupportedLanguage.TYPESCRIPT);
      expect(result.todos.length).toBe(2);
    });

    it('should detect FIXME comments', async () => {
      mockReadFile.mockResolvedValue(`
        // FIXME: Critical bug here
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.FIXME);
    });

    it('should detect HACK comments', async () => {
      mockReadFile.mockResolvedValue(`
        // HACK: Temporary workaround
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.HACK);
    });

    it('should detect OPTIMIZE comments', async () => {
      mockReadFile.mockResolvedValue(`
        // OPTIMIZE: This loop is O(n^2)
        for (let i = 0; i < n; i++) {}
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.OPTIMIZE);
    });

    it('should detect REVIEW comments', async () => {
      mockReadFile.mockResolvedValue(`
        // REVIEW: Check if this is correct
        return x + y;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.REVIEW);
    });

    it('should detect SECURITY comments', async () => {
      mockReadFile.mockResolvedValue(`
        // SECURITY: Validate input to prevent injection
        const query = buildQuery(input);
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.SECURITY);
    });

    it('should detect DEPRECATED comments', async () => {
      mockReadFile.mockResolvedValue(`
        // DEPRECATED: Use newFunction instead
        function oldFunction() {}
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.DEPRECATED);
    });

    it('should detect NOTE comments', async () => {
      mockReadFile.mockResolvedValue(`
        // NOTE: This is for documentation purposes
        const constant = 42;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.NOTE);
    });

    it('should extract assignee from @username format', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO @johndoe: Implement feature
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].assignee).toBe('johndoe');
    });

    it('should extract assignee from (username) format', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO (johndoe): Implement feature
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].assignee).toBe('johndoe');
    });

    it('should detect CRITICAL priority', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO CRITICAL: Must fix before release
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].priority).toBe(TodoPriority.CRITICAL);
    });

    it('should detect HIGH priority', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO HIGH: Important fix
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].priority).toBe(TodoPriority.HIGH);
    });

    it('should detect MEDIUM priority', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO MEDIUM: Normal priority
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].priority).toBe(TodoPriority.MEDIUM);
    });

    it('should detect LOW priority', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO LOW: Nice to have
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].priority).toBe(TodoPriority.LOW);
    });

    it('should extract JIRA issue reference', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO PROJ-123: Implement feature
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].issueRef).toBe('PROJ-123');
    });

    it('should extract GitHub issue reference', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO #456: Fix bug
        const x = 1;
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].issueRef).toBe('#456');
    });

    it('should detect TODO in Python files', async () => {
      mockReadFile.mockResolvedValue(`
        # TODO: Implement this function
        def test():
            pass
      `);

      const result = await enforcer.analyzeFile('test.py');

      expect(result.language).toBe(TodoSupportedLanguage.PYTHON);
      expect(result.todos.length).toBe(1);
    });

    it('should detect TODO in Java files', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO: Add null check
        public void test() {}
      `);

      const result = await enforcer.analyzeFile('Test.java');

      expect(result.language).toBe(TodoSupportedLanguage.JAVA);
      expect(result.todos.length).toBe(1);
    });

    it('should detect TODO in Go files', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO: Handle error
        func main() {}
      `);

      const result = await enforcer.analyzeFile('main.go');

      expect(result.language).toBe(TodoSupportedLanguage.GO);
      expect(result.todos.length).toBe(1);
    });

    it('should detect TODO in Rust files', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO: Optimize this
        fn main() {}
      `);

      const result = await enforcer.analyzeFile('main.rs');

      expect(result.language).toBe(TodoSupportedLanguage.RUST);
      expect(result.todos.length).toBe(1);
    });

    it('should detect TODO in Ruby files', async () => {
      mockReadFile.mockResolvedValue(`
        # TODO: Add validation
        def test
        end
      `);

      const result = await enforcer.analyzeFile('test.rb');

      expect(result.language).toBe(TodoSupportedLanguage.RUBY);
      expect(result.todos.length).toBe(1);
    });

    it('should detect TODO in Shell files', async () => {
      mockReadFile.mockResolvedValue(`
        # TODO: Add error handling
        echo "test"
      `);

      const result = await enforcer.analyzeFile('script.sh');

      expect(result.language).toBe(TodoSupportedLanguage.SHELL);
      expect(result.todos.length).toBe(1);
    });

    it('should handle file read errors gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await enforcer.analyzeFile('nonexistent.ts');

      expect(result.error).toBeDefined();
      expect(result.todos.length).toBe(0);
    });

    it('should return empty todos for file with no TODO comments', async () => {
      mockReadFile.mockResolvedValue(`
        // Regular comment
        function test() {
          return true;
        }
      `);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos.length).toBe(0);
    });

    it('should cache results when caching is enabled', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyzeFile('test.ts');
      await enforcer.analyzeFile('test.ts');

      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyze', () => {
    it('should analyze multiple files', async () => {
      mockReadFile
        .mockResolvedValueOnce(`// TODO: First file`)
        .mockResolvedValueOnce(`// TODO: Second file\n// FIXME: Another`);

      const result = await enforcer.analyze(['file1.ts', 'file2.ts']);

      expect(result.files.length).toBe(2);
      expect(result.todos.length).toBe(3);
    });

    it('should calculate statistics correctly', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO HIGH: High priority
        // FIXME: Bug fix
        // TODO LOW: Low priority
      `);

      const result = await enforcer.analyze(['test.ts']);

      expect(result.statistics.totalTodos).toBe(3);
      expect(result.statistics.byType[TodoType.TODO]).toBe(2);
      expect(result.statistics.byType[TodoType.FIXME]).toBe(1);
    });

    it('should include duration in result', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const result = await enforcer.analyze(['test.ts']);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkEnforcement', () => {
    it('should detect violations for FIXME with no-fixme-commit rule', async () => {
      mockReadFile.mockResolvedValue(`// FIXME: Critical bug`);

      const result = await enforcer.analyze(['test.ts']);
      const violations = enforcer.checkEnforcement(result.todos);

      expect(violations.some((v: EnforcementViolation) => v.rule.id === 'no-fixme-commit')).toBe(true);
    });

    it('should detect violations for security TODOs', async () => {
      mockReadFile.mockResolvedValue(`// SECURITY: Fix vulnerability`);

      const result = await enforcer.analyze(['test.ts']);
      const violations = enforcer.checkEnforcement(result.todos);

      expect(violations.some((v: EnforcementViolation) => v.rule.id === 'security-critical')).toBe(true);
    });

    it('should enforce require assignee when configured', async () => {
      const hook = createTodoEnforcer({ requireAssignee: true });
      mockReadFile.mockResolvedValue(`// TODO: No assignee`);

      const result = await hook.analyze(['test.ts']);
      const violations = hook.checkEnforcement(result.todos);

      expect(violations.some((v: EnforcementViolation) => v.rule.id === 'global-require-assignee')).toBe(true);
      hook.dispose();
    });

    it('should enforce require issue ref when configured', async () => {
      const hook = createTodoEnforcer({ requireIssueRef: true });
      mockReadFile.mockResolvedValue(`// TODO: No issue ref`);

      const result = await hook.analyze(['test.ts']);
      const violations = hook.checkEnforcement(result.todos);

      expect(violations.some((v: EnforcementViolation) => v.rule.id === 'global-require-issue-ref')).toBe(true);
      hook.dispose();
    });

    it('should enforce max todos when configured', async () => {
      const hook = createTodoEnforcer({ maxTodos: 2 });
      mockReadFile.mockResolvedValue(`
        // TODO: First
        // TODO: Second
        // TODO: Third
      `);

      const result = await hook.analyze(['test.ts']);
      const violations = hook.checkEnforcement(result.todos);

      expect(violations.some((v: EnforcementViolation) => v.rule.id === 'global-max-todos')).toBe(true);
      hook.dispose();
    });

    it('should not create violations for TODOs that pass all rules', async () => {
      const hook = createTodoEnforcer({
        rules: [], // No rules
        requireAssignee: false,
        requireIssueRef: false,
      });
      mockReadFile.mockResolvedValue(`// TODO: Simple task`);

      const result = await hook.analyze(['test.ts']);
      const violations = hook.checkEnforcement(result.todos);

      expect(violations.length).toBe(0);
      hook.dispose();
    });
  });

  describe('Rule Management', () => {
    it('should add new rules', () => {
      const rule: TodoEnforcementRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'A custom rule',
        level: EnforcementLevel.WARN,
      };

      enforcer.addRule(rule);
      const rules = enforcer.getRules();

      expect(rules.some((r: TodoEnforcementRule) => r.id === 'custom-rule')).toBe(true);
    });

    it('should update existing rules with same ID', () => {
      const rule: TodoEnforcementRule = {
        id: 'no-fixme-commit',
        name: 'Updated Rule',
        description: 'Updated description',
        level: EnforcementLevel.ERROR,
      };

      enforcer.addRule(rule);
      const rules = enforcer.getRules();

      const updatedRule = rules.find((r: TodoEnforcementRule) => r.id === 'no-fixme-commit');
      expect(updatedRule?.name).toBe('Updated Rule');
    });

    it('should remove rules by ID', () => {
      const removed = enforcer.removeRule('no-fixme-commit');

      expect(removed).toBe(true);
      expect(enforcer.getRules().some((r: TodoEnforcementRule) => r.id === 'no-fixme-commit')).toBe(false);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = enforcer.removeRule('non-existent-rule');

      expect(removed).toBe(false);
    });
  });

  describe('getTodos', () => {
    it('should return all tracked TODOs', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO: First
        // TODO: Second
      `);

      await enforcer.analyze(['test.ts']);
      const todos = enforcer.getTodos();

      expect(todos.length).toBe(2);
    });

    it('should return empty array before analysis', () => {
      const todos = enforcer.getTodos();

      expect(todos).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for tracked TODOs', async () => {
      mockReadFile.mockResolvedValue(`
        // TODO HIGH: High priority
        // FIXME: Bug
      `);

      await enforcer.analyze(['test.ts']);
      const stats = enforcer.getStatistics();

      expect(stats.totalTodos).toBe(2);
      expect(stats.byType[TodoType.TODO]).toBe(1);
      expect(stats.byType[TodoType.FIXME]).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should track analysis metrics', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyze(['test.ts']);
      const metrics = enforcer.getMetrics();

      expect(metrics.totalAnalyses).toBe(1);
      expect(metrics.totalTodosTracked).toBe(1);
    });

    it('should track passed analyses', async () => {
      const hook = createTodoEnforcer({ rules: [] });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await hook.analyze(['test.ts']);
      const metrics = hook.getMetrics();

      expect(metrics.passedAnalyses).toBe(1);
      expect(metrics.failedAnalyses).toBe(0);
      hook.dispose();
    });
  });

  describe('generateReport', () => {
    beforeEach(async () => {
      mockReadFile.mockResolvedValue(`
        // TODO HIGH @john: High priority task
        // FIXME: Critical bug PROJ-123
      `);
      await enforcer.analyze(['test.ts']);
    });

    it('should generate text report', () => {
      const report = enforcer.generateReport('text');

      expect(report).toContain('TODO ENFORCER REPORT');
      expect(report).toContain('Total TODOs:');
      expect(report).toContain('By Type:');
    });

    it('should generate markdown report', () => {
      const report = enforcer.generateReport('markdown');

      expect(report).toContain('# TODO Enforcer Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('| Type | Count |');
    });

    it('should generate JSON report', () => {
      const report = enforcer.generateReport('json');
      const parsed = JSON.parse(report);

      expect(parsed.statistics).toBeDefined();
      expect(parsed.todos).toBeDefined();
    });

    it('should use default format from config', () => {
      const hook = createTodoEnforcer({ reportFormat: 'json' });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const report = hook.generateReport();

      expect(() => JSON.parse(report)).not.toThrow();
      hook.dispose();
    });
  });

  describe('Event Subscriptions', () => {
    it('should emit analysis started event', async () => {
      const callback = jest.fn();
      enforcer.onAnalysisStarted(callback);
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyze(['test.ts']);

      expect(callback).toHaveBeenCalledWith(['test.ts']);
    });

    it('should emit analysis completed event', async () => {
      const callback = jest.fn();
      enforcer.onAnalysisCompleted(callback);
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyze(['test.ts']);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveProperty('todos');
    });

    it('should emit todo found event', async () => {
      const callback = jest.fn();
      enforcer.onTodoFound(callback);
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyzeFile('test.ts');

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveProperty('type', TodoType.TODO);
    });

    it('should emit violation found event', async () => {
      const callback = jest.fn();
      enforcer.onViolationFound(callback);
      mockReadFile.mockResolvedValue(`// FIXME: Bug`);

      await enforcer.analyze(['test.ts']);

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', async () => {
      const callback = jest.fn();
      const subscription = enforcer.onAnalysisStarted(callback);
      subscription.unsubscribe();
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyze(['test.ts']);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await enforcer.analyzeFile('test.ts');
      enforcer.clearCache();
      await enforcer.analyzeFile('test.ts');

      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL', async () => {
      const hook = createTodoEnforcer({ cacheTtlSeconds: 0 });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      await hook.analyzeFile('test.ts');
      // Wait a bit for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));
      await hook.analyzeFile('test.ts');

      expect(mockReadFile).toHaveBeenCalledTimes(2);
      hook.dispose();
    });
  });

  describe('dispose', () => {
    it('should clear all callbacks on dispose', async () => {
      const callback = jest.fn();
      enforcer.onAnalysisStarted(callback);
      enforcer.dispose();
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      // Create new instance since the old one is disposed
      const newEnforcer = createTodoEnforcer();
      await newEnforcer.analyze(['test.ts']);

      expect(callback).not.toHaveBeenCalled();
      newEnforcer.dispose();
    });

    it('should clear cache on dispose', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Test`);
      await enforcer.analyzeFile('test.ts');
      enforcer.dispose();

      // Create new instance
      const newEnforcer = createTodoEnforcer();
      await newEnforcer.analyzeFile('test.ts');

      expect(mockReadFile).toHaveBeenCalledTimes(2);
      newEnforcer.dispose();
    });
  });

  describe('Hook Lifecycle', () => {
    it('should be enabled by default', () => {
      expect(enforcer.isEnabled()).toBe(true);
    });

    it('should be disableable', () => {
      enforcer.disable();
      expect(enforcer.isEnabled()).toBe(false);
    });

    it('should be enableable', () => {
      enforcer.disable();
      enforcer.enable();
      expect(enforcer.isEnabled()).toBe(true);
    });

    it('should return hook configuration', () => {
      const config = enforcer.getConfig();

      expect(config.name).toBe('todo-enforcer');
      expect(config.description).toBe('Detects and enforces TODO completion in code');
    });
  });

  describe('Language Detection', () => {
    const languageTests: Array<{ extension: string; expected: TodoSupportedLanguage }> = [
      { extension: '.ts', expected: TodoSupportedLanguage.TYPESCRIPT },
      { extension: '.tsx', expected: TodoSupportedLanguage.TYPESCRIPT },
      { extension: '.js', expected: TodoSupportedLanguage.JAVASCRIPT },
      { extension: '.jsx', expected: TodoSupportedLanguage.JAVASCRIPT },
      { extension: '.py', expected: TodoSupportedLanguage.PYTHON },
      { extension: '.java', expected: TodoSupportedLanguage.JAVA },
      { extension: '.go', expected: TodoSupportedLanguage.GO },
      { extension: '.rs', expected: TodoSupportedLanguage.RUST },
      { extension: '.c', expected: TodoSupportedLanguage.C },
      { extension: '.cpp', expected: TodoSupportedLanguage.CPP },
      { extension: '.cs', expected: TodoSupportedLanguage.CSHARP },
      { extension: '.rb', expected: TodoSupportedLanguage.RUBY },
      { extension: '.php', expected: TodoSupportedLanguage.PHP },
      { extension: '.sh', expected: TodoSupportedLanguage.SHELL },
      { extension: '.yaml', expected: TodoSupportedLanguage.YAML },
      { extension: '.yml', expected: TodoSupportedLanguage.YAML },
      { extension: '.md', expected: TodoSupportedLanguage.MARKDOWN },
      { extension: '.html', expected: TodoSupportedLanguage.HTML },
      { extension: '.css', expected: TodoSupportedLanguage.CSS },
    ];

    languageTests.forEach(({ extension, expected }) => {
      it(`should detect ${expected} from ${extension} extension`, async () => {
        mockReadFile.mockResolvedValue('// TODO: Test');

        const result = await enforcer.analyzeFile(`test${extension}`);

        expect(result.language).toBe(expected);
      });
    });

    it('should return UNKNOWN for unrecognized extensions', async () => {
      mockReadFile.mockResolvedValue('// TODO: Test');

      const result = await enforcer.analyzeFile('test.xyz');

      expect(result.language).toBe(TodoSupportedLanguage.UNKNOWN);
    });
  });

  describe('Priority Detection', () => {
    const priorityTests: Array<{ marker: string; expected: TodoPriority }> = [
      { marker: 'CRITICAL', expected: TodoPriority.CRITICAL },
      { marker: 'URGENT', expected: TodoPriority.CRITICAL },
      { marker: 'ASAP', expected: TodoPriority.CRITICAL },
      { marker: 'P0', expected: TodoPriority.CRITICAL },
      { marker: 'HIGH', expected: TodoPriority.HIGH },
      { marker: 'IMPORTANT', expected: TodoPriority.HIGH },
      { marker: 'P1', expected: TodoPriority.HIGH },
      { marker: 'MEDIUM', expected: TodoPriority.MEDIUM },
      { marker: 'P2', expected: TodoPriority.MEDIUM },
      { marker: 'LOW', expected: TodoPriority.LOW },
      { marker: 'MINOR', expected: TodoPriority.LOW },
      { marker: 'P3', expected: TodoPriority.LOW },
    ];

    priorityTests.forEach(({ marker, expected }) => {
      it(`should detect ${expected} priority from ${marker} marker`, async () => {
        mockReadFile.mockResolvedValue(`// TODO ${marker}: Task`);

        const result = await enforcer.analyzeFile('test.ts');

        expect(result.todos[0].priority).toBe(expected);
      });
    });

    it('should default to NONE priority when no marker', async () => {
      mockReadFile.mockResolvedValue(`// TODO: Simple task`);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].priority).toBe(TodoPriority.NONE);
    });
  });

  describe('Message Extraction', () => {
    it('should extract clean message without metadata', async () => {
      mockReadFile.mockResolvedValue(`// TODO HIGH @john PROJ-123: Implement feature`);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].message).toBe('Implement feature');
    });

    it('should preserve message content after colon', async () => {
      mockReadFile.mockResolvedValue(`// TODO: This is the actual task description`);

      const result = await enforcer.analyzeFile('test.ts');

      expect(result.todos[0].message).toBe('This is the actual task description');
    });
  });

  describe('Custom Patterns', () => {
    it('should detect custom TODO patterns', async () => {
      const hook = createTodoEnforcer({
        customPatterns: ['\\bXXX\\b'],
      });
      mockReadFile.mockResolvedValue(`// XXX: Custom marker`);

      const result = await hook.analyzeFile('test.ts');

      expect(result.todos.length).toBe(1);
      expect(result.todos[0].type).toBe(TodoType.CUSTOM);
      hook.dispose();
    });
  });

  describe('Enforcement Levels', () => {
    it('should correctly identify ERROR level violations', async () => {
      const hook = createTodoEnforcer({
        rules: [
          {
            id: 'test-error',
            name: 'Test Error',
            description: 'Test',
            types: [TodoType.TODO],
            level: EnforcementLevel.ERROR,
          },
        ],
      });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const result = await hook.analyze(['test.ts']);

      expect(result.violations.some((v: EnforcementViolation) => v.level === EnforcementLevel.ERROR)).toBe(true);
      hook.dispose();
    });

    it('should correctly identify WARN level violations', async () => {
      const hook = createTodoEnforcer({
        rules: [
          {
            id: 'test-warn',
            name: 'Test Warn',
            description: 'Test',
            types: [TodoType.TODO],
            level: EnforcementLevel.WARN,
          },
        ],
      });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const result = await hook.analyze(['test.ts']);

      expect(result.violations.some((v: EnforcementViolation) => v.level === EnforcementLevel.WARN)).toBe(true);
      hook.dispose();
    });

    it('should mark analysis as passed when only warnings', async () => {
      const hook = createTodoEnforcer({
        rules: [
          {
            id: 'test-warn',
            name: 'Test Warn',
            description: 'Test',
            types: [TodoType.TODO],
            level: EnforcementLevel.WARN,
          },
        ],
      });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const result = await hook.analyze(['test.ts']);

      expect(result.passed).toBe(true);
      hook.dispose();
    });

    it('should mark analysis as failed when errors present', async () => {
      const hook = createTodoEnforcer({
        rules: [
          {
            id: 'test-error',
            name: 'Test Error',
            description: 'Test',
            types: [TodoType.TODO],
            level: EnforcementLevel.ERROR,
          },
        ],
      });
      mockReadFile.mockResolvedValue(`// TODO: Test`);

      const result = await hook.analyze(['test.ts']);

      expect(result.passed).toBe(false);
      hook.dispose();
    });
  });
});

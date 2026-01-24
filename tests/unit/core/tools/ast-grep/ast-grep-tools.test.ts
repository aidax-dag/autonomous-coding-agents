/**
 * AST-Grep Tools Tests
 *
 * Tests for AST-grep tool wrappers.
 */

import { ASTSearchTool } from '@/core/tools/ast-grep/ast-search.tool';
import { ASTLintTool } from '@/core/tools/ast-grep/ast-lint.tool';
import { ASTRewriteTool } from '@/core/tools/ast-grep/ast-rewrite.tool';
import {
  IASTGrepClient,
  ASTSearchResult,
  ASTLintResult,
  ASTRewriteResult,
  ASTLanguage,
  ASTRuleSeverity,
  ASTMatch,
} from '@/core/tools/ast-grep/ast-grep.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('AST-Grep Tools', () => {
  // Create a mock AST-grep client factory
  const createMockASTClient = (): jest.Mocked<IASTGrepClient> => ({
    initialize: jest.fn(),
    dispose: jest.fn(),
    isAvailable: jest.fn(),
    getVersion: jest.fn(),
    searchFile: jest.fn(),
    searchDirectory: jest.fn(),
    searchCode: jest.fn(),
    findSymbol: jest.fn(),
    findCalls: jest.fn(),
    findImports: jest.fn(),
    registerRule: jest.fn(),
    unregisterRule: jest.fn(),
    getRule: jest.fn(),
    getAllRules: jest.fn(),
    getRulesByCategory: jest.fn(),
    getRulesByLanguage: jest.fn(),
    loadRulesFromFile: jest.fn(),
    loadRulesFromDirectory: jest.fn(),
    setRuleEnabled: jest.fn(),
    lintFile: jest.fn(),
    lintDirectory: jest.fn(),
    lintCode: jest.fn(),
    rewriteFile: jest.fn(),
    rewriteDirectory: jest.fn(),
    applyRewriteRule: jest.fn(),
    applyFixes: jest.fn(),
    transformCode: jest.fn(),
    parseCode: jest.fn(),
    parseFile: jest.fn(),
    getNodeKindAt: jest.fn(),
    getNodeKinds: jest.fn(),
    validatePattern: jest.fn(),
    detectLanguage: jest.fn(),
    getSupportedLanguages: jest.fn(),
    clearCache: jest.fn(),
    getStatistics: jest.fn(),
  });

  describe('ASTSearchTool', () => {
    let tool: ASTSearchTool;
    let mockClient: jest.Mocked<IASTGrepClient>;

    beforeEach(() => {
      mockClient = createMockASTClient();
      tool = new ASTSearchTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('ast-search');
      expect(tool.description).toContain('pattern');
    });

    it('should execute search on file successfully', async () => {
      const match: ASTMatch = {
        text: 'console.log("test")',
        location: {
          file: '/test.ts',
          range: {
            start: { line: 5, column: 0, offset: 50 },
            end: { line: 5, column: 20, offset: 70 },
          },
        },
        metaVariables: {
          ARGS: {
            name: 'ARGS',
            text: '"test"',
            range: {
              start: { line: 5, column: 12, offset: 62 },
              end: { line: 5, column: 18, offset: 68 },
            },
          },
        },
        nodeKind: 'call_expression',
      };

      const searchResult: ASTSearchResult = {
        matchCount: 1,
        fileCount: 1,
        matchesByFile: { '/test.ts': [match] },
        matches: [match],
        duration: 50,
        pattern: 'console.log($ARGS)',
        language: ASTLanguage.TYPESCRIPT,
      };

      mockClient.searchFile.mockResolvedValue({
        success: true,
        data: searchResult,
      });

      const result = await tool.execute({
        pattern: 'console.log($ARGS)',
        path: '/test.ts',
        language: ASTLanguage.TYPESCRIPT,
      });

      expect(result.success).toBe(true);
      expect(result.data?.matchCount).toBe(1);
      expect(mockClient.searchFile).toHaveBeenCalledWith(
        '/test.ts',
        'console.log($ARGS)',
        ASTLanguage.TYPESCRIPT,
        undefined
      );
    });

    it('should execute search on directory successfully', async () => {
      const searchResult: ASTSearchResult = {
        matchCount: 5,
        fileCount: 3,
        matchesByFile: {},
        matches: [],
        duration: 150,
        pattern: 'console.log($ARGS)',
        language: ASTLanguage.TYPESCRIPT,
      };

      mockClient.searchDirectory.mockResolvedValue({
        success: true,
        data: searchResult,
      });

      const result = await tool.execute({
        pattern: 'console.log($ARGS)',
        path: '/src/',
      });

      expect(result.success).toBe(true);
      expect(result.data?.matchCount).toBe(5);
      expect(mockClient.searchDirectory).toHaveBeenCalled();
    });

    it('should handle search failure', async () => {
      mockClient.searchFile.mockResolvedValue({
        success: false,
        error: 'Invalid pattern',
      });

      const result = await tool.execute({
        pattern: 'invalid[[pattern',
        path: '/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AST_SEARCH_FAILED');
    });

    it('should check availability', async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      expect(await tool.isAvailable()).toBe(true);

      mockClient.isAvailable.mockResolvedValue(false);
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  describe('ASTLintTool', () => {
    let tool: ASTLintTool;
    let mockClient: jest.Mocked<IASTGrepClient>;

    beforeEach(() => {
      mockClient = createMockASTClient();
      tool = new ASTLintTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('ast-lint');
      expect(tool.description.toLowerCase()).toContain('lint');
    });

    it('should execute lint on file successfully', async () => {
      const lintResult: ASTLintResult = {
        violations: [],
        violationsByFile: {},
        violationsBySeverity: {
          [ASTRuleSeverity.ERROR]: [],
          [ASTRuleSeverity.WARNING]: [],
          [ASTRuleSeverity.INFO]: [],
          [ASTRuleSeverity.HINT]: [],
          [ASTRuleSeverity.OFF]: [],
        },
        filesAnalyzed: 1,
        totalViolations: 0,
        duration: 100,
        rulesRun: ['no-console', 'no-unused-vars'],
      };

      mockClient.lintFile.mockResolvedValue({
        success: true,
        data: lintResult,
      });

      const result = await tool.execute({
        path: '/test.ts',
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalViolations).toBe(0);
      expect(mockClient.lintFile).toHaveBeenCalledWith('/test.ts', undefined);
    });

    it('should execute lint on directory successfully', async () => {
      const lintResult: ASTLintResult = {
        violations: [],
        violationsByFile: {},
        violationsBySeverity: {
          [ASTRuleSeverity.ERROR]: [],
          [ASTRuleSeverity.WARNING]: [],
          [ASTRuleSeverity.INFO]: [],
          [ASTRuleSeverity.HINT]: [],
          [ASTRuleSeverity.OFF]: [],
        },
        filesAnalyzed: 10,
        totalViolations: 3,
        duration: 500,
        rulesRun: ['no-console'],
      };

      mockClient.lintDirectory.mockResolvedValue({
        success: true,
        data: lintResult,
      });

      const result = await tool.execute({
        path: '/src/',
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesAnalyzed).toBe(10);
      expect(mockClient.lintDirectory).toHaveBeenCalled();
    });

    it('should handle lint failure', async () => {
      mockClient.lintFile.mockResolvedValue({
        success: false,
        error: 'No rules configured',
      });

      const result = await tool.execute({
        path: '/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AST_LINT_FAILED');
    });
  });

  describe('ASTRewriteTool', () => {
    let tool: ASTRewriteTool;
    let mockClient: jest.Mocked<IASTGrepClient>;

    beforeEach(() => {
      mockClient = createMockASTClient();
      tool = new ASTRewriteTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('ast-rewrite');
      expect(tool.description).toContain('Transform');
    });

    it('should execute rewrite on file successfully', async () => {
      const rewriteResult: ASTRewriteResult = {
        transformations: [
          {
            location: {
              file: '/test.ts',
              range: {
                start: { line: 5, column: 0, offset: 50 },
                end: { line: 5, column: 20, offset: 70 },
              },
            },
            originalText: 'console.log("test")',
            replacementText: 'logger.info("test")',
          },
        ],
        modifiedFiles: ['/test.ts'],
        newContent: {
          '/test.ts': 'const x = 1;\nlogger.info("test");',
        },
        replacementCount: 1,
        duration: 75,
        applied: true,
        errors: [],
      };

      mockClient.rewriteFile.mockResolvedValue({
        success: true,
        data: rewriteResult,
      });

      const result = await tool.execute({
        pattern: 'console.log($ARGS)',
        replacement: 'logger.info($ARGS)',
        path: '/test.ts',
        language: ASTLanguage.TYPESCRIPT,
      });

      expect(result.success).toBe(true);
      expect(result.data?.replacementCount).toBe(1);
      expect(mockClient.rewriteFile).toHaveBeenCalledWith(
        '/test.ts',
        'console.log($ARGS)',
        'logger.info($ARGS)',
        ASTLanguage.TYPESCRIPT,
        undefined
      );
    });

    it('should execute rewrite on directory successfully', async () => {
      const rewriteResult: ASTRewriteResult = {
        transformations: [],
        modifiedFiles: ['/src/a.ts', '/src/b.ts'],
        newContent: {},
        replacementCount: 10,
        duration: 200,
        applied: true,
        errors: [],
      };

      mockClient.rewriteDirectory.mockResolvedValue({
        success: true,
        data: rewriteResult,
      });

      const result = await tool.execute({
        pattern: 'var $NAME = $VALUE',
        replacement: 'const $NAME = $VALUE',
        path: '/src/',
      });

      expect(result.success).toBe(true);
      expect(result.data?.replacementCount).toBe(10);
      expect(mockClient.rewriteDirectory).toHaveBeenCalled();
    });

    it('should handle rewrite with dry run option', async () => {
      const rewriteResult: ASTRewriteResult = {
        transformations: [],
        modifiedFiles: [],
        newContent: { '/test.ts': 'new content' },
        replacementCount: 5,
        duration: 50,
        applied: false,
        errors: [],
      };

      mockClient.rewriteFile.mockResolvedValue({
        success: true,
        data: rewriteResult,
      });

      const result = await tool.execute({
        pattern: 'console.log($ARGS)',
        replacement: 'logger.info($ARGS)',
        path: '/test.ts',
        options: { dryRun: true },
      });

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(false);
    });

    it('should handle rewrite failure', async () => {
      mockClient.rewriteFile.mockResolvedValue({
        success: false,
        error: 'File is read-only',
      });

      const result = await tool.execute({
        pattern: 'console.log($ARGS)',
        replacement: 'logger.info($ARGS)',
        path: '/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AST_REWRITE_FAILED');
    });

    it('should check availability', async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      expect(await tool.isAvailable()).toBe(true);

      mockClient.isAvailable.mockResolvedValue(false);
      expect(await tool.isAvailable()).toBe(false);
    });
  });
});

/**
 * AST-Grep Client Implementation
 *
 * Provides AST-based code search, transformation, and linting capabilities.
 * Supports both native pattern matching and external ast-grep CLI integration.
 *
 * @module core/tools/ast-grep/ast-grep-client
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IASTGrepClient,
  ASTGrepClientConfig,
  ASTLanguage,
  ASTOperationResult,
  ASTSearchResult,
  ASTSearchOptions,
  ASTMatch,
  ASTMatchContext,
  ASTMetaVariable,
  ASTPosition,
  ASTRule,
  ASTRuleCategory,
  ASTRuleSeverity,
  ASTRuleViolation,
  ASTLintResult,
  ASTLintOptions,
  ASTRewriteResult,
  ASTRewriteOptions,
  ASTRewriteRule,
  ASTTransformation,
  ASTNode,
  ASTError,
  ASTErrorType,
  ASTGrepStatistics,
  ASTPatternConstraint,
  DEFAULT_AST_GREP_CONFIG,
  FILE_EXTENSION_LANGUAGE_MAP,
  detectLanguageFromPath,
} from './ast-grep.interface.js';

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// AST-Grep Client
// ============================================================================

/**
 * AST-Grep client for code search, transformation, and linting
 */
export class ASTGrepClient implements IASTGrepClient {
  private config: ASTGrepClientConfig;
  private rules: Map<string, ASTRule> = new Map();
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private statistics: ASTGrepStatistics;
  private initialized = false;
  private binaryAvailable: boolean | null = null;

  /**
   * Returns whether the client has been initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  constructor(config?: ASTGrepClientConfig) {
    this.config = { ...DEFAULT_AST_GREP_CONFIG, ...config };
    this.statistics = this.createEmptyStatistics();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(config?: ASTGrepClientConfig): Promise<ASTOperationResult> {
    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Check if ast-grep binary is available
      this.binaryAvailable = await this.checkBinaryAvailable();

      // Load rules from directory if specified
      if (this.config.rulesDirectory) {
        await this.loadRulesFromDirectory(this.config.rulesDirectory);
      }

      this.initialized = true;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize AST-Grep client: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async dispose(): Promise<ASTOperationResult> {
    this.rules.clear();
    this.cache.clear();
    this.initialized = false;
    return { success: true };
  }

  async isAvailable(): Promise<boolean> {
    if (this.binaryAvailable === null) {
      this.binaryAvailable = await this.checkBinaryAvailable();
    }
    return this.binaryAvailable;
  }

  async getVersion(): Promise<ASTOperationResult<string>> {
    try {
      const result = await this.executeCommand(['--version']);
      if (result.success && result.data) {
        const version = result.data.trim();
        return { success: true, data: version };
      }
      // Fallback to native implementation version
      return { success: true, data: '1.0.0-native' };
    } catch {
      return { success: true, data: '1.0.0-native' };
    }
  }

  // -------------------------------------------------------------------------
  // Search Operations
  // -------------------------------------------------------------------------

  async searchFile(
    file: string,
    pattern: string,
    language?: ASTLanguage,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    const startTime = Date.now();

    try {
      // Detect language if not specified
      const lang = language || detectLanguageFromPath(file);
      if (!lang) {
        return {
          success: false,
          error: `Could not detect language for file: ${file}`,
        };
      }

      // Read file content
      const content = await fs.readFile(file, 'utf-8');

      // Search in content
      const matches = await this.searchInContent(content, pattern, lang, file, options);

      const duration = Date.now() - startTime;
      this.updateSearchStatistics(matches.length, duration);

      const result: ASTSearchResult = {
        matchCount: matches.length,
        fileCount: matches.length > 0 ? 1 : 0,
        matchesByFile: matches.length > 0 ? { [file]: matches } : {},
        matches,
        duration,
        pattern,
        language: lang,
      };

      return { success: true, data: result };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async searchDirectory(
    directory: string,
    pattern: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultSearchOptions, ...options };
      const files = await this.collectFiles(directory, mergedOptions);

      const allMatches: ASTMatch[] = [];
      const matchesByFile: Record<string, ASTMatch[]> = {};

      for (const file of files) {
        const lang = detectLanguageFromPath(file);
        if (!lang) continue;

        // Check language filter
        if (mergedOptions.languages && !mergedOptions.languages.includes(lang)) {
          continue;
        }

        try {
          const content = await fs.readFile(file, 'utf-8');
          const matches = await this.searchInContent(content, pattern, lang, file, mergedOptions);

          if (matches.length > 0) {
            matchesByFile[file] = matches;
            allMatches.push(...matches);
          }

          // Check max matches limit
          if (mergedOptions.maxMatches && allMatches.length >= mergedOptions.maxMatches) {
            break;
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      const duration = Date.now() - startTime;
      this.updateSearchStatistics(allMatches.length, duration);

      // Determine the language (use first file's language or typescript as default)
      const firstFile = Object.keys(matchesByFile)[0];
      const detectedLang = firstFile ? detectLanguageFromPath(firstFile) : undefined;

      const result: ASTSearchResult = {
        matchCount: allMatches.length,
        fileCount: Object.keys(matchesByFile).length,
        matchesByFile,
        matches: allMatches,
        duration,
        pattern,
        language: detectedLang || ASTLanguage.TYPESCRIPT,
      };

      return { success: true, data: result };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Directory search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async searchCode(
    code: string,
    pattern: string,
    language: ASTLanguage,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    const startTime = Date.now();

    try {
      const matches = await this.searchInContent(code, pattern, language, '<code>', options);

      const duration = Date.now() - startTime;
      this.updateSearchStatistics(matches.length, duration);

      const result: ASTSearchResult = {
        matchCount: matches.length,
        fileCount: matches.length > 0 ? 1 : 0,
        matchesByFile: matches.length > 0 ? { '<code>': matches } : {},
        matches,
        duration,
        pattern,
        language,
      };

      return { success: true, data: result };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Code search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async findSymbol(
    directory: string,
    symbolName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    // Create patterns for different symbol types
    const patterns = [
      `function ${symbolName}`,
      `const ${symbolName}`,
      `let ${symbolName}`,
      `var ${symbolName}`,
      `class ${symbolName}`,
      `interface ${symbolName}`,
      `type ${symbolName}`,
      `enum ${symbolName}`,
    ];

    const allMatches: ASTMatch[] = [];
    const matchesByFile: Record<string, ASTMatch[]> = {};
    const startTime = Date.now();

    for (const pattern of patterns) {
      const result = await this.searchDirectory(directory, pattern, options);
      if (result.success && result.data) {
        for (const [file, matches] of Object.entries(result.data.matchesByFile)) {
          if (!matchesByFile[file]) {
            matchesByFile[file] = [];
          }
          matchesByFile[file].push(...matches);
          allMatches.push(...matches);
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        matchCount: allMatches.length,
        fileCount: Object.keys(matchesByFile).length,
        matchesByFile,
        matches: allMatches,
        duration,
        pattern: symbolName,
        language: ASTLanguage.TYPESCRIPT,
      },
    };
  }

  async findCalls(
    directory: string,
    functionName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    const pattern = `${functionName}($$$ARGS)`;
    return this.searchDirectory(directory, pattern, options);
  }

  async findImports(
    directory: string,
    moduleName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>> {
    const patterns = [
      `import $$$SPECIFIERS from '${moduleName}'`,
      `import $$$SPECIFIERS from "${moduleName}"`,
      `require('${moduleName}')`,
      `require("${moduleName}")`,
    ];

    const allMatches: ASTMatch[] = [];
    const matchesByFile: Record<string, ASTMatch[]> = {};
    const startTime = Date.now();

    for (const pattern of patterns) {
      const result = await this.searchDirectory(directory, pattern, options);
      if (result.success && result.data) {
        for (const [file, matches] of Object.entries(result.data.matchesByFile)) {
          if (!matchesByFile[file]) {
            matchesByFile[file] = [];
          }
          matchesByFile[file].push(...matches);
          allMatches.push(...matches);
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        matchCount: allMatches.length,
        fileCount: Object.keys(matchesByFile).length,
        matchesByFile,
        matches: allMatches,
        duration,
        pattern: moduleName,
        language: ASTLanguage.TYPESCRIPT,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Rule Management
  // -------------------------------------------------------------------------

  registerRule(rule: ASTRule): ASTOperationResult {
    if (this.rules.has(rule.id)) {
      return {
        success: false,
        error: `Rule with id '${rule.id}' already exists`,
      };
    }
    this.rules.set(rule.id, rule);
    return { success: true };
  }

  unregisterRule(ruleId: string): ASTOperationResult {
    if (!this.rules.has(ruleId)) {
      return {
        success: false,
        error: `Rule with id '${ruleId}' not found`,
      };
    }
    this.rules.delete(ruleId);
    return { success: true };
  }

  getRule(ruleId: string): ASTRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): ASTRule[] {
    return Array.from(this.rules.values());
  }

  getRulesByCategory(category: ASTRuleCategory): ASTRule[] {
    return Array.from(this.rules.values()).filter((rule) => rule.category === category);
  }

  getRulesByLanguage(language: ASTLanguage): ASTRule[] {
    return Array.from(this.rules.values()).filter((rule) => {
      if (Array.isArray(rule.language)) {
        return rule.language.includes(language);
      }
      return rule.language === language;
    });
  }

  async loadRulesFromFile(filePath: string): Promise<ASTOperationResult<ASTRule[]>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const rules = this.parseRulesYaml(content);

      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }

      return { success: true, data: rules };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load rules from file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async loadRulesFromDirectory(directory: string): Promise<ASTOperationResult<ASTRule[]>> {
    try {
      const files = await fs.readdir(directory);
      const allRules: ASTRule[] = [];

      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const result = await this.loadRulesFromFile(path.join(directory, file));
          if (result.success && result.data) {
            allRules.push(...result.data);
          }
        }
      }

      return { success: true, data: allRules };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load rules from directory: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setRuleEnabled(ruleId: string, enabled: boolean): ASTOperationResult {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return {
        success: false,
        error: `Rule with id '${ruleId}' not found`,
      };
    }
    rule.enabled = enabled;
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Lint Operations
  // -------------------------------------------------------------------------

  async lintFile(
    file: string,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>> {
    const startTime = Date.now();

    try {
      const content = await fs.readFile(file, 'utf-8');
      const language = detectLanguageFromPath(file);

      if (!language) {
        return {
          success: false,
          error: `Could not detect language for file: ${file}`,
        };
      }

      const violations = await this.lintContent(content, language, file, options);

      const duration = Date.now() - startTime;
      this.updateLintStatistics(violations.length, duration);

      return {
        success: true,
        data: this.createLintResult(violations, [file], duration, options),
      };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Lint failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async lintDirectory(
    directory: string,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>> {
    const startTime = Date.now();

    try {
      const files = await this.collectFiles(directory, {
        include: options?.include,
        exclude: options?.exclude,
      });

      const allViolations: ASTRuleViolation[] = [];

      for (const file of files) {
        const language = detectLanguageFromPath(file);
        if (!language) continue;

        try {
          const content = await fs.readFile(file, 'utf-8');
          const violations = await this.lintContent(content, language, file, options);
          allViolations.push(...violations);

          if (options?.maxViolations && allViolations.length >= options.maxViolations) {
            break;
          }
        } catch {
          continue;
        }
      }

      const duration = Date.now() - startTime;
      this.updateLintStatistics(allViolations.length, duration);

      return {
        success: true,
        data: this.createLintResult(allViolations, files, duration, options),
      };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Directory lint failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async lintCode(
    code: string,
    language: ASTLanguage,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>> {
    const startTime = Date.now();

    try {
      const violations = await this.lintContent(code, language, '<code>', options);

      const duration = Date.now() - startTime;
      this.updateLintStatistics(violations.length, duration);

      return {
        success: true,
        data: this.createLintResult(violations, ['<code>'], duration, options),
      };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Code lint failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Rewrite/Transform Operations
  // -------------------------------------------------------------------------

  async rewriteFile(
    file: string,
    pattern: string,
    replacement: string,
    language?: ASTLanguage,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultRewriteOptions, ...options };
      const lang = language || detectLanguageFromPath(file);

      if (!lang) {
        return {
          success: false,
          error: `Could not detect language for file: ${file}`,
        };
      }

      const content = await fs.readFile(file, 'utf-8');
      const { newContent, transformations } = await this.transformContent(
        content,
        pattern,
        replacement,
        lang,
        file
      );

      if (!mergedOptions.dryRun && transformations.length > 0) {
        // Create backup if requested
        if (mergedOptions.backup) {
          const ext = mergedOptions.backupExtension || '.bak';
          await fs.writeFile(file + ext, content);
        }

        await fs.writeFile(file, newContent);
      }

      const duration = Date.now() - startTime;
      this.updateRewriteStatistics(transformations.length, duration);

      return {
        success: true,
        data: {
          transformations,
          modifiedFiles: transformations.length > 0 ? [file] : [],
          newContent: { [file]: newContent },
          replacementCount: transformations.length,
          duration,
          applied: !mergedOptions.dryRun,
          errors: [],
        },
      };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Rewrite failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async rewriteDirectory(
    directory: string,
    pattern: string,
    replacement: string,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultRewriteOptions, ...options };
      const files = await this.collectFiles(directory, {
        include: mergedOptions.include,
        exclude: mergedOptions.exclude,
      });

      const allTransformations: ASTTransformation[] = [];
      const modifiedFiles: string[] = [];
      const newContent: Record<string, string> = {};
      const errors: ASTError[] = [];

      for (const file of files) {
        const lang = detectLanguageFromPath(file);
        if (!lang) continue;

        try {
          const content = await fs.readFile(file, 'utf-8');
          const result = await this.transformContent(content, pattern, replacement, lang, file);

          if (result.transformations.length > 0) {
            allTransformations.push(...result.transformations);
            modifiedFiles.push(file);
            newContent[file] = result.newContent;

            if (!mergedOptions.dryRun) {
              if (mergedOptions.backup) {
                const ext = mergedOptions.backupExtension || '.bak';
                await fs.writeFile(file + ext, content);
              }
              await fs.writeFile(file, result.newContent);
            }
          }

          if (mergedOptions.maxFiles && modifiedFiles.length >= mergedOptions.maxFiles) {
            break;
          }
        } catch (err) {
          errors.push({
            type: ASTErrorType.FILE_ERROR,
            message: `Failed to process file: ${file}`,
            file,
            details: err,
          });
        }
      }

      const duration = Date.now() - startTime;
      this.updateRewriteStatistics(allTransformations.length, duration);

      return {
        success: true,
        data: {
          transformations: allTransformations,
          modifiedFiles,
          newContent,
          replacementCount: allTransformations.length,
          duration,
          applied: !mergedOptions.dryRun,
          errors,
        },
      };
    } catch (error) {
      this.statistics.errorsEncountered++;
      return {
        success: false,
        error: `Directory rewrite failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async applyRewriteRule(
    directory: string,
    rule: ASTRewriteRule,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>> {
    return this.rewriteDirectory(directory, rule.pattern, rule.replacement, {
      ...options,
      include: options?.include,
    });
  }

  async applyFixes(
    violations: ASTRuleViolation[],
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultRewriteOptions, ...options };
      const fixableViolations = violations.filter(
        (v) => v.rule.fix && v.suggestedFix
      );

      // Group by file
      const violationsByFile = new Map<string, ASTRuleViolation[]>();
      for (const violation of fixableViolations) {
        const file = violation.match.location.file;
        if (!violationsByFile.has(file)) {
          violationsByFile.set(file, []);
        }
        violationsByFile.get(file)!.push(violation);
      }

      const allTransformations: ASTTransformation[] = [];
      const modifiedFiles: string[] = [];
      const newContent: Record<string, string> = {};

      for (const [file, fileViolations] of violationsByFile) {
        // Sort violations by position in reverse order (bottom to top)
        fileViolations.sort((a, b) => {
          const aOffset = a.match.location.range.start.offset;
          const bOffset = b.match.location.range.start.offset;
          return bOffset - aOffset;
        });

        let content = await fs.readFile(file, 'utf-8');

        for (const violation of fileViolations) {
          const { start, end } = violation.match.location.range;
          const replacement = violation.suggestedFix!;

          content =
            content.substring(0, start.offset) +
            replacement +
            content.substring(end.offset);

          allTransformations.push({
            location: violation.match.location,
            originalText: violation.match.text,
            replacementText: replacement,
            ruleId: violation.rule.id,
            description: violation.message,
          });
        }

        modifiedFiles.push(file);
        newContent[file] = content;

        if (!mergedOptions.dryRun) {
          if (mergedOptions.backup) {
            const ext = mergedOptions.backupExtension || '.bak';
            const originalContent = await fs.readFile(file, 'utf-8');
            await fs.writeFile(file + ext, originalContent);
          }
          await fs.writeFile(file, content);
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          transformations: allTransformations,
          modifiedFiles,
          newContent,
          replacementCount: allTransformations.length,
          duration,
          applied: !mergedOptions.dryRun,
          errors: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Apply fixes failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async transformCode(
    code: string,
    pattern: string,
    replacement: string,
    language: ASTLanguage
  ): Promise<ASTOperationResult<string>> {
    const startTime = Date.now();

    try {
      const result = await this.transformContent(code, pattern, replacement, language, '<code>');
      const duration = Date.now() - startTime;
      this.updateRewriteStatistics(result.transformations.length, duration);
      return { success: true, data: result.newContent };
    } catch (error) {
      return {
        success: false,
        error: `Transform failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Analysis Operations
  // -------------------------------------------------------------------------

  async parseCode(
    code: string,
    _language: ASTLanguage
  ): Promise<ASTOperationResult<ASTNode>> {
    try {
      // Create a simple AST representation
      // Note: _language parameter reserved for future tree-sitter integration
      const lines = code.split('\n');
      const rootNode: ASTNode = {
        kind: 'program',
        text: code,
        range: {
          start: { line: 0, column: 0, offset: 0 },
          end: { line: lines.length - 1, column: lines[lines.length - 1]?.length || 0, offset: code.length },
        },
        children: [],
        namedChildren: {},
        isNamed: true,
        hasError: false,
      };

      return { success: true, data: rootNode };
    } catch (error) {
      return {
        success: false,
        error: `Parse failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async parseFile(file: string): Promise<ASTOperationResult<ASTNode>> {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const language = detectLanguageFromPath(file);

      if (!language) {
        return {
          success: false,
          error: `Could not detect language for file: ${file}`,
        };
      }

      return this.parseCode(content, language);
    } catch (error) {
      return {
        success: false,
        error: `Parse file failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getNodeKindAt(
    _code: string,
    _position: ASTPosition,
    _language: ASTLanguage
  ): Promise<ASTOperationResult<string>> {
    // Simplified implementation - returns generic node kind
    // Note: Parameters reserved for future tree-sitter integration
    return { success: true, data: 'expression' };
  }

  async getNodeKinds(
    _code: string,
    _language: ASTLanguage
  ): Promise<ASTOperationResult<string[]>> {
    // Return common node kinds for the language
    // Note: Parameters reserved for future tree-sitter integration
    const commonKinds = [
      'program',
      'function_declaration',
      'class_declaration',
      'variable_declaration',
      'expression_statement',
      'if_statement',
      'for_statement',
      'while_statement',
      'return_statement',
      'call_expression',
      'member_expression',
      'identifier',
      'string',
      'number',
      'object',
      'array',
    ];
    return { success: true, data: commonKinds };
  }

  // -------------------------------------------------------------------------
  // Utility Operations
  // -------------------------------------------------------------------------

  async validatePattern(
    pattern: string,
    _language: ASTLanguage
  ): Promise<ASTOperationResult<boolean>> {
    try {
      // Basic pattern validation
      // Note: _language parameter reserved for language-specific pattern validation
      // Check for unbalanced brackets, parentheses, braces
      const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
      const stack: string[] = [];

      for (const char of pattern) {
        if (brackets[char]) {
          stack.push(brackets[char]);
        } else if (Object.values(brackets).includes(char)) {
          if (stack.pop() !== char) {
            return {
              success: true,
              data: false,
            };
          }
        }
      }

      return { success: true, data: stack.length === 0 };
    } catch (error) {
      return {
        success: false,
        error: `Pattern validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  detectLanguage(filePath: string): ASTLanguage | undefined {
    return detectLanguageFromPath(filePath);
  }

  getSupportedLanguages(): ASTLanguage[] {
    return Object.values(ASTLanguage);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getStatistics(): ASTGrepStatistics {
    return { ...this.statistics };
  }

  // -------------------------------------------------------------------------
  // Private Helper Methods
  // -------------------------------------------------------------------------

  private async checkBinaryAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const binaryPath = this.config.binaryPath || 'sg';
      const proc = spawn(binaryPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Timeout after 5 seconds - store reference so we can clear it
      const timeoutId = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);

      proc.on('error', () => {
        clearTimeout(timeoutId);
        resolve(false);
      });
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code === 0);
      });
    });
  }

  private async executeCommand(args: string[]): Promise<ASTOperationResult<string>> {
    return new Promise((resolve) => {
      const binaryPath = this.config.binaryPath || 'sg';
      const proc = spawn(binaryPath, args, {
        cwd: this.config.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Apply timeout - store reference so we can clear it on completion
      const timeout = this.config.defaultTimeout || 30000;
      const timeoutId = setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: 'Command timed out',
        });
      }, timeout);

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `Command execution failed: ${err.message}`,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve({ success: true, data: stdout });
        } else {
          resolve({
            success: false,
            error: stderr || `Command exited with code ${code}`,
          });
        }
      });
    });
  }

  private async collectFiles(
    directory: string,
    options?: { include?: string[]; exclude?: string[] }
  ): Promise<string[]> {
    const files: string[] = [];

    const processDirectory = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check if file has a supported extension
          const ext = path.extname(entry.name).toLowerCase();
          if (FILE_EXTENSION_LANGUAGE_MAP[ext]) {
            // Check include/exclude patterns
            if (this.matchesPatterns(fullPath, options?.include, options?.exclude)) {
              files.push(fullPath);
            }
          }
        }
      }
    };

    await processDirectory(directory);
    return files;
  }

  private matchesPatterns(
    filePath: string,
    include?: string[],
    exclude?: string[]
  ): boolean {
    // Simple glob matching
    if (exclude) {
      for (const pattern of exclude) {
        if (this.simpleGlobMatch(filePath, pattern)) {
          return false;
        }
      }
    }

    if (include && include.length > 0) {
      for (const pattern of include) {
        if (this.simpleGlobMatch(filePath, pattern)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  private simpleGlobMatch(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(regex).test(filePath);
  }

  private async searchInContent(
    content: string,
    pattern: string,
    _language: ASTLanguage,
    file: string,
    options?: ASTSearchOptions
  ): Promise<ASTMatch[]> {
    // Note: _language reserved for future language-specific pattern matching
    const matches: ASTMatch[] = [];
    const lines = content.split('\n');

    // Convert AST pattern to regex for simple matching
    const regex = this.patternToRegex(pattern);

    let match: RegExpExecArray | null;
    const globalRegex = new RegExp(regex.source, 'g' + (options?.caseSensitive === false ? 'i' : ''));

    while ((match = globalRegex.exec(content)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;

      const startPos = this.offsetToPosition(content, startOffset);
      const endPos = this.offsetToPosition(content, endOffset);

      const metaVariables = this.extractMetaVariables(pattern, match[0]);

      const astMatch: ASTMatch = {
        text: match[0],
        location: {
          file,
          range: {
            start: startPos,
            end: endPos,
          },
        },
        metaVariables,
        nodeKind: 'match',
      };

      // Add context if requested
      if (options?.contextLines && options.contextLines > 0) {
        astMatch.context = this.getMatchContext(lines, startPos.line, endPos.line, options.contextLines);
      }

      matches.push(astMatch);

      // Check max matches
      if (options?.maxMatches && matches.length >= options.maxMatches) {
        break;
      }
    }

    return matches;
  }

  private patternToRegex(pattern: string): RegExp {
    // IMPORTANT: Process metavariables BEFORE escaping regex special characters
    // Otherwise $ gets escaped and metavariables won't be recognized

    // Step 1: Replace metavariables with unique placeholders
    // $$$VAR matches zero or more (any characters)
    let regexPattern = pattern.replace(/\$\$\$([A-Z_][A-Z0-9_]*)/g, '<<<MULTI_$1>>>');
    // $VAR matches a single expression
    regexPattern = regexPattern.replace(/\$([A-Z_][A-Z0-9_]*)/g, '<<<SINGLE_$1>>>');

    // Step 2: Escape special regex characters (but not our placeholders)
    regexPattern = regexPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s*');

    // Step 3: Replace placeholders with actual regex capture groups
    // $$$VAR matches zero or more (any characters, handles nested parens somewhat)
    regexPattern = regexPattern.replace(/<<<MULTI_([A-Z_][A-Z0-9_]*)>>>/g, '([^)]*)');
    // $VAR matches a single expression (balanced content up to delimiter)
    regexPattern = regexPattern.replace(/<<<SINGLE_([A-Z_][A-Z0-9_]*)>>>/g, '([^,;)\\]]+?)');

    return new RegExp(regexPattern);
  }

  private extractMetaVariables(
    pattern: string,
    matchedText: string
  ): Record<string, ASTMetaVariable> {
    const metaVariables: Record<string, ASTMetaVariable> = {};

    // Extract metavariable names from pattern
    const metaVarPattern = /\$\$?\$?([A-Z_][A-Z0-9_]*)/g;
    let match: RegExpExecArray | null;
    const varNames: string[] = [];

    while ((match = metaVarPattern.exec(pattern)) !== null) {
      varNames.push(match[1]);
    }

    // For now, create simple metavariable entries
    for (const name of varNames) {
      metaVariables[name] = {
        name,
        text: matchedText,
        range: {
          start: { line: 0, column: 0, offset: 0 },
          end: { line: 0, column: matchedText.length, offset: matchedText.length },
        },
      };
    }

    return metaVariables;
  }

  private offsetToPosition(content: string, offset: number): ASTPosition {
    let line = 0;
    let column = 0;
    let currentOffset = 0;

    for (const char of content) {
      if (currentOffset === offset) {
        break;
      }
      if (char === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
      currentOffset++;
    }

    return { line, column, offset };
  }

  private getMatchContext(
    lines: string[],
    startLine: number,
    endLine: number,
    contextLines: number
  ): ASTMatchContext {
    const beforeStart = Math.max(0, startLine - contextLines);
    const afterEnd = Math.min(lines.length - 1, endLine + contextLines);

    return {
      before: lines.slice(beforeStart, startLine),
      after: lines.slice(endLine + 1, afterEnd + 1),
      lineNumbers: {
        start: beforeStart,
        end: afterEnd,
      },
    };
  }

  private async lintContent(
    content: string,
    language: ASTLanguage,
    file: string,
    options?: ASTLintOptions
  ): Promise<ASTRuleViolation[]> {
    const violations: ASTRuleViolation[] = [];

    // Get applicable rules
    let rules = this.getRulesByLanguage(language);

    // Filter by enabled status
    rules = rules.filter((rule) => rule.enabled);

    // Filter by rule IDs if specified
    if (options?.ruleIds && options.ruleIds.length > 0) {
      rules = rules.filter((rule) => options.ruleIds!.includes(rule.id));
    }

    // Filter by categories if specified
    if (options?.categories && options.categories.length > 0) {
      rules = rules.filter((rule) => options.categories!.includes(rule.category));
    }

    // Filter by minimum severity
    if (options?.minSeverity) {
      const severityOrder = [
        ASTRuleSeverity.OFF,
        ASTRuleSeverity.HINT,
        ASTRuleSeverity.INFO,
        ASTRuleSeverity.WARNING,
        ASTRuleSeverity.ERROR,
      ];
      const minIndex = severityOrder.indexOf(options.minSeverity);
      rules = rules.filter((rule) => severityOrder.indexOf(rule.severity) >= minIndex);
    }

    // Run each rule
    for (const rule of rules) {
      const ruleMatches = await this.searchInContent(content, rule.pattern, language, file);

      for (const match of ruleMatches) {
        // Check constraints
        if (rule.constraints && !this.checkConstraints(match, rule.constraints)) {
          continue;
        }

        const violation: ASTRuleViolation = {
          rule,
          match,
          message: rule.description || `Violation of rule: ${rule.name}`,
        };

        // Generate suggested fix if rule has a fix
        if (rule.fix) {
          violation.suggestedFix = this.applyReplacement(match.text, match.metaVariables, rule.fix.replacement);
        }

        violations.push(violation);

        if (options?.maxViolations && violations.length >= options.maxViolations) {
          return violations;
        }
      }
    }

    return violations;
  }

  private checkConstraints(
    match: ASTMatch,
    constraints: ASTPatternConstraint[]
  ): boolean {
    for (const constraint of constraints) {
      const metaVar = match.metaVariables[constraint.metaVariable];
      if (!metaVar) continue;

      if (constraint.regex) {
        const regex = new RegExp(constraint.regex);
        if (!regex.test(metaVar.text)) return false;
      }

      if (constraint.contains) {
        if (!metaVar.text.includes(constraint.contains)) return false;
      }

      if (constraint.notContains) {
        if (metaVar.text.includes(constraint.notContains)) return false;
      }
    }

    return true;
  }

  private createLintResult(
    violations: ASTRuleViolation[],
    files: string[],
    duration: number,
    options?: ASTLintOptions
  ): ASTLintResult {
    const violationsByFile: Record<string, ASTRuleViolation[]> = {};
    const violationsBySeverity: Record<ASTRuleSeverity, ASTRuleViolation[]> = {
      [ASTRuleSeverity.ERROR]: [],
      [ASTRuleSeverity.WARNING]: [],
      [ASTRuleSeverity.INFO]: [],
      [ASTRuleSeverity.HINT]: [],
      [ASTRuleSeverity.OFF]: [],
    };

    for (const violation of violations) {
      const file = violation.match.location.file;
      if (!violationsByFile[file]) {
        violationsByFile[file] = [];
      }
      violationsByFile[file].push(violation);
      violationsBySeverity[violation.rule.severity].push(violation);
    }

    const rulesRun = options?.ruleIds || Array.from(this.rules.keys());

    return {
      violations,
      violationsByFile,
      violationsBySeverity,
      filesAnalyzed: files.length,
      totalViolations: violations.length,
      duration,
      rulesRun,
    };
  }

  private async transformContent(
    content: string,
    pattern: string,
    replacement: string,
    language: ASTLanguage,
    file: string
  ): Promise<{ newContent: string; transformations: ASTTransformation[] }> {
    const matches = await this.searchInContent(content, pattern, language, file);
    const transformations: ASTTransformation[] = [];

    // Sort matches by offset in reverse order (bottom to top)
    matches.sort((a, b) => b.location.range.start.offset - a.location.range.start.offset);

    let newContent = content;

    for (const match of matches) {
      const replacementText = this.applyReplacement(match.text, match.metaVariables, replacement);
      const { start, end } = match.location.range;

      newContent =
        newContent.substring(0, start.offset) +
        replacementText +
        newContent.substring(end.offset);

      transformations.push({
        location: match.location,
        originalText: match.text,
        replacementText,
        description: `Replaced pattern: ${pattern}`,
      });
    }

    return { newContent, transformations };
  }

  private applyReplacement(
    _matchedText: string,
    metaVariables: Record<string, ASTMetaVariable>,
    replacement: string
  ): string {
    // Note: _matchedText reserved for future use in complex replacements
    let result = replacement;

    // Replace metavariables in the replacement template
    for (const [name, metaVar] of Object.entries(metaVariables)) {
      result = result.replace(new RegExp(`\\$\\$?\\$?${name}`, 'g'), metaVar.text);
    }

    return result;
  }

  private parseRulesYaml(content: string): ASTRule[] {
    // Simple YAML-like parsing for rules
    // In production, use a proper YAML parser
    const rules: ASTRule[] = [];

    // This is a simplified parser - in production use yaml library
    try {
      // Extract rule blocks
      const ruleBlocks = content.split(/^---$/m).filter((b) => b.trim());

      for (const block of ruleBlocks) {
        const rule = this.parseRuleBlock(block);
        if (rule) {
          rules.push(rule);
        }
      }
    } catch {
      // Silently fail for now
    }

    return rules;
  }

  private parseRuleBlock(block: string): ASTRule | null {
    const lines = block.split('\n');
    const rule: Partial<ASTRule> = {
      enabled: true,
      severity: ASTRuleSeverity.WARNING,
      category: ASTRuleCategory.CUSTOM,
    };

    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        switch (key) {
          case 'id':
            rule.id = value.trim();
            break;
          case 'name':
            rule.name = value.trim();
            break;
          case 'description':
            rule.description = value.trim();
            break;
          case 'pattern':
            rule.pattern = value.trim();
            break;
          case 'language':
            rule.language = value.trim() as ASTLanguage;
            break;
          case 'severity':
            rule.severity = value.trim() as ASTRuleSeverity;
            break;
          case 'category':
            rule.category = value.trim() as ASTRuleCategory;
            break;
        }
      }
    }

    if (rule.id && rule.name && rule.pattern && rule.language) {
      return rule as ASTRule;
    }

    return null;
  }

  private createEmptyStatistics(): ASTGrepStatistics {
    return {
      totalSearches: 0,
      totalMatches: 0,
      totalLints: 0,
      totalViolations: 0,
      totalRewrites: 0,
      totalReplacements: 0,
      avgSearchDuration: 0,
      avgLintDuration: 0,
      cacheHitRate: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
    };
  }

  private updateSearchStatistics(matchCount: number, duration: number): void {
    this.statistics.totalSearches++;
    this.statistics.totalMatches += matchCount;
    this.statistics.avgSearchDuration =
      (this.statistics.avgSearchDuration * (this.statistics.totalSearches - 1) + duration) /
      this.statistics.totalSearches;
  }

  private updateLintStatistics(violationCount: number, duration: number): void {
    this.statistics.totalLints++;
    this.statistics.totalViolations += violationCount;
    this.statistics.avgLintDuration =
      (this.statistics.avgLintDuration * (this.statistics.totalLints - 1) + duration) /
      this.statistics.totalLints;
  }

  private updateRewriteStatistics(replacementCount: number, _duration: number): void {
    // Note: _duration reserved for future avgRewriteDuration tracking
    this.statistics.totalRewrites++;
    this.statistics.totalReplacements += replacementCount;
  }
}

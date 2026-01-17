/**
 * Documentation Checker
 *
 * Analyzes documentation coverage by checking JSDoc/TSDoc comments,
 * README files, and API documentation.
 *
 * @module core/quality/checks/documentation-checker
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { QualityCheckResult, QualityDimension } from '../completion-detector.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Documentation status for a symbol
 */
export interface SymbolDocumentation {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'method' | 'property';
  line: number;
  hasDocComment: boolean;
  hasDescription: boolean;
  hasParams: boolean;
  hasReturns: boolean;
  hasExample: boolean;
  isExported: boolean;
}

/**
 * Documentation status for a file
 */
export interface FileDocumentation {
  path: string;
  hasFileComment: boolean;
  symbols: SymbolDocumentation[];
  documentedCount: number;
  totalExported: number;
  coveragePercent: number;
}

/**
 * Documentation summary
 */
export interface DocumentationSummary {
  totalFiles: number;
  totalSymbols: number;
  documentedSymbols: number;
  coveragePercent: number;
  hasReadme: boolean;
  hasChangelog: boolean;
  hasContributing: boolean;
  hasApiDocs: boolean;
  fileDetails: FileDocumentation[];
  undocumentedExports: string[];
}

/**
 * Documentation checker configuration
 */
export interface DocumentationConfig {
  minCoverage?: number;
  requireFileComments?: boolean;
  requireParamDocs?: boolean;
  requireReturnDocs?: boolean;
  requireExamples?: boolean;
  ignorePatterns?: string[];
  checkReadme?: boolean;
  checkChangelog?: boolean;
  extensions?: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_DOCUMENTATION_CONFIG: DocumentationConfig = {
  minCoverage: 70,
  requireFileComments: true,
  requireParamDocs: true,
  requireReturnDocs: true,
  requireExamples: false,
  ignorePatterns: ['node_modules', 'dist', 'build', 'coverage', '__tests__', '*.test.*', '*.spec.*'],
  checkReadme: true,
  checkChangelog: true,
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
};

// ============================================================================
// Documentation Checker Implementation
// ============================================================================

/**
 * Documentation checker for analyzing code documentation coverage
 */
export class DocumentationChecker {
  private config: DocumentationConfig;

  constructor(config: Partial<DocumentationConfig> = {}) {
    this.config = { ...DEFAULT_DOCUMENTATION_CONFIG, ...config };
  }

  /**
   * Check documentation coverage for a workspace
   */
  async check(workspacePath: string): Promise<QualityCheckResult> {
    try {
      const summary = await this.getDocumentationSummary(workspacePath);
      return this.evaluateDocumentation(summary);
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Get comprehensive documentation summary
   */
  async getDocumentationSummary(workspacePath: string): Promise<DocumentationSummary> {
    // Check for project documentation files
    const hasReadme = await this.fileExists(workspacePath, ['README.md', 'readme.md', 'README', 'Readme.md']);
    const hasChangelog = await this.fileExists(workspacePath, ['CHANGELOG.md', 'changelog.md', 'HISTORY.md', 'CHANGES.md']);
    const hasContributing = await this.fileExists(workspacePath, ['CONTRIBUTING.md', 'contributing.md']);
    const hasApiDocs = await this.directoryExists(workspacePath, ['docs', 'documentation', 'api-docs']);

    // Analyze source files
    const sourceFiles = await this.findSourceFiles(workspacePath);
    const fileDetails: FileDocumentation[] = [];
    const undocumentedExports: string[] = [];

    let totalSymbols = 0;
    let documentedSymbols = 0;

    for (const filePath of sourceFiles.slice(0, 200)) { // Limit for performance
      const fileDoc = await this.analyzeFile(filePath);
      if (fileDoc) {
        fileDetails.push(fileDoc);
        totalSymbols += fileDoc.totalExported;
        documentedSymbols += fileDoc.documentedCount;

        // Track undocumented exports
        for (const symbol of fileDoc.symbols) {
          if (symbol.isExported && !symbol.hasDocComment) {
            undocumentedExports.push(`${path.basename(filePath)}:${symbol.name}`);
          }
        }
      }
    }

    const coveragePercent = totalSymbols > 0
      ? Math.round((documentedSymbols / totalSymbols) * 100)
      : 100;

    return {
      totalFiles: fileDetails.length,
      totalSymbols,
      documentedSymbols,
      coveragePercent,
      hasReadme,
      hasChangelog,
      hasContributing,
      hasApiDocs,
      fileDetails,
      undocumentedExports,
    };
  }

  /**
   * Check if file exists in workspace
   */
  private async fileExists(workspacePath: string, names: string[]): Promise<boolean> {
    for (const name of names) {
      try {
        await fs.access(path.join(workspacePath, name));
        return true;
      } catch {
        // Continue checking other names
      }
    }
    return false;
  }

  /**
   * Check if directory exists in workspace
   */
  private async directoryExists(workspacePath: string, names: string[]): Promise<boolean> {
    for (const name of names) {
      try {
        const stat = await fs.stat(path.join(workspacePath, name));
        if (stat.isDirectory()) return true;
      } catch {
        // Continue checking other names
      }
    }
    return false;
  }

  /**
   * Find source files in workspace
   */
  private async findSourceFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = this.config.extensions || ['.ts', '.tsx', '.js', '.jsx'];
    const ignorePatterns = this.config.ignorePatterns || [];

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(workspacePath, fullPath);

          // Check ignore patterns
          if (ignorePatterns.some(p => relativePath.includes(p) || entry.name.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    await walkDir(workspacePath);
    return files;
  }

  /**
   * Analyze documentation in a single file
   */
  private async analyzeFile(filePath: string): Promise<FileDocumentation | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for file-level doc comment
      const hasFileComment = this.hasFileDocComment(content);

      // Find and analyze symbols
      const symbols = this.findSymbols(content, lines);

      // Count documented exported symbols
      const exportedSymbols = symbols.filter(s => s.isExported);
      const documentedCount = exportedSymbols.filter(s => s.hasDocComment).length;

      return {
        path: filePath,
        hasFileComment,
        symbols,
        documentedCount,
        totalExported: exportedSymbols.length,
        coveragePercent: exportedSymbols.length > 0
          ? Math.round((documentedCount / exportedSymbols.length) * 100)
          : 100,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file has a file-level doc comment
   */
  private hasFileDocComment(content: string): boolean {
    // Look for @module, @file, or file-level comment at the start
    const fileCommentPatterns = [
      /^\/\*\*[\s\S]*?@(?:module|file|fileoverview|packageDocumentation)/m,
      /^\/\*\*\s*\n\s*\*\s+\w+/m, // Any JSDoc at start of file
    ];

    const trimmedContent = content.trimStart();
    return fileCommentPatterns.some(p => p.test(trimmedContent));
  }

  /**
   * Find symbols and their documentation status
   */
  private findSymbols(content: string, _lines: string[]): SymbolDocumentation[] {
    const symbols: SymbolDocumentation[] = [];

    // Patterns for finding various symbol types
    const patterns: Array<{
      regex: RegExp;
      type: SymbolDocumentation['type'];
      exportCheck: (match: RegExpExecArray, content: string) => boolean;
    }> = [
      {
        regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
        type: 'function',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
      {
        regex: /(?:export\s+)?class\s+(\w+)/g,
        type: 'class',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
      {
        regex: /(?:export\s+)?interface\s+(\w+)/g,
        type: 'interface',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
      {
        regex: /(?:export\s+)?type\s+(\w+)\s*=/g,
        type: 'type',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
      {
        regex: /(?:export\s+)?enum\s+(\w+)/g,
        type: 'enum',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
      {
        regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/g,
        type: 'variable',
        exportCheck: (match, content) => content.substring(Math.max(0, match.index - 20), match.index).includes('export'),
      },
    ];

    for (const { regex, type, exportCheck } of patterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const startPos = match.index;
        const lineNumber = content.substring(0, startPos).split('\n').length;
        const isExported = exportCheck(match, content);

        // Check for JSDoc above this symbol
        const docInfo = this.findDocComment(content, startPos);

        // Skip if we already have this symbol (from another pattern)
        if (!symbols.some(s => s.name === name && s.line === lineNumber)) {
          symbols.push({
            name,
            type,
            line: lineNumber,
            hasDocComment: docInfo.hasComment,
            hasDescription: docInfo.hasDescription,
            hasParams: docInfo.hasParams,
            hasReturns: docInfo.hasReturns,
            hasExample: docInfo.hasExample,
            isExported,
          });
        }
      }
    }

    return symbols;
  }

  /**
   * Find doc comment above a position
   */
  private findDocComment(content: string, position: number): {
    hasComment: boolean;
    hasDescription: boolean;
    hasParams: boolean;
    hasReturns: boolean;
    hasExample: boolean;
  } {
    // Look backwards from position to find JSDoc comment
    const beforePosition = content.substring(0, position);
    const lastNewline = beforePosition.lastIndexOf('\n');
    const searchStart = Math.max(0, lastNewline - 2000); // Search up to 2000 chars back

    const searchArea = content.substring(searchStart, position);

    // Find the last JSDoc comment before this position
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
    let lastMatch = null;
    let match;

    while ((match = jsdocPattern.exec(searchArea)) !== null) {
      // Check if there's only whitespace between the comment and position
      const afterComment = searchArea.substring(match.index + match[0].length);
      if (/^\s*$/.test(afterComment) || /^\s*(export\s+)?$/.test(afterComment.split('\n')[0])) {
        lastMatch = match[0];
      }
    }

    if (!lastMatch) {
      return {
        hasComment: false,
        hasDescription: false,
        hasParams: false,
        hasReturns: false,
        hasExample: false,
      };
    }

    // Analyze the JSDoc comment
    const comment = lastMatch;

    // Check for description (any text that's not a tag)
    const descriptionMatch = comment.match(/\/\*\*\s*\n?\s*\*\s+([^@*\n][\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/)/);
    const hasDescription = !!descriptionMatch && descriptionMatch[1].trim().length > 10;

    const hasParams = /@param\s/.test(comment);
    const hasReturns = /@returns?\s/.test(comment);
    const hasExample = /@example/.test(comment);

    return {
      hasComment: true,
      hasDescription,
      hasParams,
      hasReturns,
      hasExample,
    };
  }

  /**
   * Evaluate documentation against thresholds
   */
  private evaluateDocumentation(summary: DocumentationSummary): QualityCheckResult {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check coverage
    if (summary.coveragePercent < this.config.minCoverage!) {
      const deficit = this.config.minCoverage! - summary.coveragePercent;
      score -= Math.min(40, deficit);
      issues.push(`Documentation coverage ${summary.coveragePercent}% below minimum ${this.config.minCoverage}%`);
    }

    // Check for README
    if (this.config.checkReadme && !summary.hasReadme) {
      score -= 15;
      recommendations.push('Add a README.md file to describe the project');
    }

    // Check for CHANGELOG
    if (this.config.checkChangelog && !summary.hasChangelog) {
      score -= 5;
      recommendations.push('Add a CHANGELOG.md to track version history');
    }

    // Check for API docs
    if (!summary.hasApiDocs && summary.totalSymbols > 50) {
      score -= 10;
      recommendations.push('Consider adding a docs/ directory with API documentation');
    }

    // List undocumented exports
    if (summary.undocumentedExports.length > 0) {
      const top5 = summary.undocumentedExports.slice(0, 5);
      recommendations.push(
        `Document exported symbols: ${top5.join(', ')}${summary.undocumentedExports.length > 5 ? ` and ${summary.undocumentedExports.length - 5} more` : ''}`
      );
    }

    // Files without file comments
    const filesWithoutComment = summary.fileDetails.filter(f => !f.hasFileComment);
    if (this.config.requireFileComments && filesWithoutComment.length > 0) {
      score -= Math.min(10, filesWithoutComment.length);
      recommendations.push(
        `Add file-level documentation to ${filesWithoutComment.length} files`
      );
    }

    score = Math.max(0, Math.round(score));
    const passed = summary.coveragePercent >= this.config.minCoverage! && summary.hasReadme;

    return {
      dimension: QualityDimension.DOCUMENTATION,
      passed,
      score,
      threshold: this.config.minCoverage!,
      details: `Documentation coverage: ${summary.coveragePercent}%, ${summary.documentedSymbols}/${summary.totalSymbols} exported symbols documented` +
        (summary.hasReadme ? ', README present' : ', README missing'),
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Create result for errors
   */
  private createErrorResult(error: unknown): QualityCheckResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dimension: QualityDimension.DOCUMENTATION,
      passed: false,
      score: 0,
      threshold: this.config.minCoverage!,
      details: `Error checking documentation: ${message}`,
      recommendations: ['Check project structure', 'Verify file permissions'],
    };
  }

  /**
   * Get undocumented exported symbols
   */
  async getUndocumentedExports(workspacePath: string): Promise<string[]> {
    const summary = await this.getDocumentationSummary(workspacePath);
    return summary.undocumentedExports;
  }

  /**
   * Get files with low documentation coverage
   */
  async getLowCoverageFiles(workspacePath: string, threshold = 50): Promise<FileDocumentation[]> {
    const summary = await this.getDocumentationSummary(workspacePath);
    return summary.fileDetails
      .filter(f => f.coveragePercent < threshold && f.totalExported > 0)
      .sort((a, b) => a.coveragePercent - b.coveragePercent);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a documentation checker instance
 */
export function createDocumentationChecker(
  config: Partial<DocumentationConfig> = {}
): DocumentationChecker {
  return new DocumentationChecker(config);
}

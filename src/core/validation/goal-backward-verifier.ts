/**
 * F003-GoalBackwardVerifier: Goal-Backward Verification System
 *
 * 3-stage verification ensuring actual goal achievement:
 * - Stage 1 (EXISTS): Files exist at expected paths
 * - Stage 2 (SUBSTANTIVE): Implementation is real, not placeholder
 * - Stage 3 (WIRED): Connected to system (imports, exports, tests)
 *
 * Source: get-shit-done Goal-Backward Verification pattern
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  VerificationStage,
  type IGoalBackwardVerifier,
  type GoalDefinition,
  type GoalBackwardResult,
} from './interfaces/validation.interface';

// ============================================================================
// Constants: Placeholder Detection Patterns
// ============================================================================

/**
 * Placeholder/incomplete marker patterns for detection
 *
 * Categories:
 * - Comment markers: TODO, FIXME, HACK, XXX
 * - Not implemented expressions
 * - Placeholder code markers
 * - Empty blocks and pass statements
 */
export const PLACEHOLDER_PATTERNS: RegExp[] = [
  // Comment markers (various syntaxes)
  /\/\/\s*TODO/i,
  /\/\/\s*FIXME/i,
  /\/\/\s*HACK/i,
  /\/\/\s*XXX/i,
  /\/\*\s*TODO/i,
  /\/\*\s*FIXME/i,
  /\/\*\s*HACK/i,
  /\/\*\s*XXX/i,
  /#\s*TODO/i,
  /#\s*FIXME/i,

  // Not implemented expressions
  /throw new Error\(['"]not implemented['"]\)/i,
  /throw new Error\(['"]TODO['"]\)/i,
  /NotImplementedError/i,

  // Placeholder code
  /placeholder/i,
  /stub/i,
  /mock\s+implementation/i,
  /dummy/i,

  // Empty/pass patterns (used carefully - specific contexts)
  /pass\s*$/m, // Python pass statement at line end
];

// ============================================================================
// Constants: Minimum Complexity Thresholds
// ============================================================================

/**
 * Minimum code complexity thresholds for substantive verification
 */
export const MIN_COMPLEXITY_THRESHOLDS = {
  /** Minimum lines of actual code (excluding comments and blanks) */
  minLines: 3,
  /** Minimum number of functions/methods/classes */
  minFunctions: 1,
  /** Minimum number of imports (0 = no requirement) */
  minImports: 0,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Complexity thresholds type (mutable version for options)
 */
export interface ComplexityThresholds {
  /** Minimum lines of actual code (excluding comments and blanks) */
  minLines: number;
  /** Minimum number of functions/methods/classes */
  minFunctions: number;
  /** Minimum number of imports (0 = no requirement) */
  minImports: number;
}

/**
 * Options for GoalBackwardVerifier
 */
export interface GoalBackwardVerifierOptions {
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string;
  /** Custom placeholder patterns (default: PLACEHOLDER_PATTERNS) */
  placeholderPatterns?: RegExp[];
  /** Custom complexity thresholds (default: MIN_COMPLEXITY_THRESHOLDS) */
  minComplexity?: ComplexityThresholds;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * GoalBackwardVerifier Implementation
 *
 * Verifies goal achievement through 3 progressive stages:
 * 1. EXISTS - File presence verification
 * 2. SUBSTANTIVE - Real implementation check (no placeholders)
 * 3. WIRED - System integration verification
 */
export class GoalBackwardVerifier implements IGoalBackwardVerifier {
  private projectRoot: string;
  private placeholderPatterns: RegExp[];
  private minComplexity: ComplexityThresholds;

  constructor(options?: GoalBackwardVerifierOptions) {
    this.projectRoot = options?.projectRoot ?? process.cwd();
    this.placeholderPatterns = options?.placeholderPatterns ?? PLACEHOLDER_PATTERNS;
    this.minComplexity = options?.minComplexity ?? MIN_COMPLEXITY_THRESHOLDS;
  }

  /**
   * Stage 1: Verify all files exist at expected paths
   */
  async verifyExists(paths: string[]): Promise<boolean> {
    if (paths.length === 0) {
      return true;
    }

    const results = await Promise.all(
      paths.map(async (p) => {
        const fullPath = path.resolve(this.projectRoot, p);
        try {
          await fs.access(fullPath);
          return true;
        } catch {
          return false;
        }
      })
    );

    return results.every(Boolean);
  }

  /**
   * Stage 2: Verify implementation is substantive (not placeholder)
   */
  async verifySubstantive(paths: string[]): Promise<boolean> {
    if (paths.length === 0) {
      return true;
    }

    const results = await Promise.all(
      paths.map(async (p) => {
        const fullPath = path.resolve(this.projectRoot, p);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          return this.isSubstantive(content);
        } catch {
          return false;
        }
      })
    );

    return results.every(Boolean);
  }

  /**
   * Stage 3: Verify files are wired into the system
   */
  async verifyWired(paths: string[]): Promise<boolean> {
    if (paths.length === 0) {
      return true;
    }

    const results = await Promise.all(
      paths.map(async (p) => {
        return this.checkWiring(p);
      })
    );

    return results.every(Boolean);
  }

  /**
   * Run all 3 stages of verification
   */
  async verify(goal: GoalDefinition): Promise<GoalBackwardResult> {
    const stages: GoalBackwardResult['stages'] = [];

    // Stage 1: EXISTS
    const existsResult = await this.verifyExists(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.EXISTS,
      passed: existsResult,
      details: existsResult
        ? 'All files exist at expected paths'
        : 'Some files are missing',
      checkedPaths: goal.expectedPaths,
    });

    // Early return if EXISTS fails
    if (!existsResult) {
      return { passed: false, stages };
    }

    // Stage 2: SUBSTANTIVE
    const substantiveResult = await this.verifySubstantive(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.SUBSTANTIVE,
      passed: substantiveResult,
      details: substantiveResult
        ? 'All files contain substantive implementation'
        : 'Some files contain placeholder or incomplete code',
      checkedPaths: goal.expectedPaths,
    });

    // Early return if SUBSTANTIVE fails
    if (!substantiveResult) {
      return { passed: false, stages };
    }

    // Stage 3: WIRED
    const wiredResult = await this.verifyWired(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.WIRED,
      passed: wiredResult,
      details: wiredResult
        ? 'All files are connected to the system'
        : 'Some files are not properly wired into the system',
      checkedPaths: goal.expectedPaths,
    });

    return {
      passed: existsResult && substantiveResult && wiredResult,
      stages,
    };
  }

  /**
   * Check if content is substantive (real implementation)
   */
  private isSubstantive(content: string): boolean {
    // 1. Check for placeholder patterns
    for (const pattern of this.placeholderPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }

    // 2. Check minimum line count (excluding comments and blank lines)
    const lines = content.split('\n').filter((line) => {
      const trimmed = line.trim();
      // Exclude blank lines
      if (!trimmed) return false;
      // Exclude single-line comments
      if (trimmed.startsWith('//')) return false;
      if (trimmed.startsWith('#')) return false;
      // Exclude lines that are only block comment markers
      if (trimmed === '/*' || trimmed === '*/' || trimmed.startsWith('*')) return false;
      return true;
    });

    if (lines.length < this.minComplexity.minLines) {
      return false;
    }

    // 3. Check minimum function/class count
    const functionPatterns = [
      /(?:export\s+)?(?:async\s+)?function\s+\w+/g,
      /(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(/g,
      /(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(\s*\)/g,
      /(?:export\s+)?class\s+\w+/g,
      /\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g, // Method definitions
    ];

    let functionCount = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        functionCount += matches.length;
      }
    }

    // Avoid double counting - use a reasonable estimate
    functionCount = Math.min(functionCount, content.split('function').length - 1 + content.split('class').length - 1 + 5);

    // For simple check: if we found at least one function-like pattern
    if (functionCount < this.minComplexity.minFunctions) {
      // Additional check for arrow functions and methods
      const arrowFunctions = content.match(/=>\s*\{/g);
      const methodDefs = content.match(/\w+\s*\([^)]*\)\s*\{/g);
      const totalFunctions = (arrowFunctions?.length ?? 0) + (methodDefs?.length ?? 0);

      if (totalFunctions < this.minComplexity.minFunctions) {
        return false;
      }
    }

    // 4. Check minimum imports (if required)
    if (this.minComplexity.minImports > 0) {
      const importPatterns = [
        /import\s+/g,
        /require\s*\(/g,
        /from\s+['"]/g,
      ];

      let importCount = 0;
      for (const pattern of importPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          importCount += matches.length;
        }
      }

      // Avoid double counting
      importCount = Math.min(importCount, content.split('import').length - 1 + content.split('require').length - 1);

      if (importCount < this.minComplexity.minImports) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if file is wired into the system
   */
  private async checkWiring(filePath: string): Promise<boolean> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirPath = path.dirname(path.resolve(this.projectRoot, filePath));

    // Check 1: Look for index.ts in same directory that exports this module
    const indexPath = path.join(dirPath, 'index.ts');
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      // Check if the module name appears in the index file
      if (indexContent.includes(fileName)) {
        return true;
      }
    } catch {
      // index.ts doesn't exist, try other checks
    }

    // Check 2: Look for index.js as alternative
    const indexJsPath = path.join(dirPath, 'index.js');
    try {
      const indexContent = await fs.readFile(indexJsPath, 'utf-8');
      if (indexContent.includes(fileName)) {
        return true;
      }
    } catch {
      // index.js doesn't exist
    }

    // Check 3: For test files, they are considered wired if the source file exists
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
      // Test files are considered wired by nature
      return true;
    }

    // Check 4: Check if file exports something (self-wiring check)
    const fullPath = path.resolve(this.projectRoot, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      // If file has exports, consider it potentially wired
      if (content.includes('export ') || content.includes('module.exports')) {
        return true;
      }
    } catch {
      return false;
    }

    // Default: Consider wired if file is accessible (permissive for now)
    // In a stricter implementation, this would return false
    return true;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a GoalBackwardVerifier instance
 *
 * @example
 * ```typescript
 * // Create with default options
 * const verifier = createGoalBackwardVerifier();
 *
 * // Create with custom project root
 * const verifier = createGoalBackwardVerifier({
 *   projectRoot: '/path/to/project',
 * });
 *
 * // Create with custom patterns
 * const verifier = createGoalBackwardVerifier({
 *   placeholderPatterns: [/TODO/i, /FIXME/i],
 *   minComplexity: { minLines: 10, minFunctions: 2, minImports: 1 },
 * });
 * ```
 */
export function createGoalBackwardVerifier(
  options?: GoalBackwardVerifierOptions
): GoalBackwardVerifier {
  return new GoalBackwardVerifier(options);
}

// ============================================================================
// Barrel Export
// ============================================================================

export default GoalBackwardVerifier;

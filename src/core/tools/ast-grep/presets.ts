/**
 * AST-Grep Presets
 *
 * Collection of common AST-grep patterns for code quality analysis.
 * Each preset is an SGRule object ready for use with ASTGrepClient.searchByRule().
 *
 * @module core/tools/ast-grep
 */

import type { SGRule } from './ast-grep-client';

// ============================================================================
// Preset Rules
// ============================================================================

/**
 * Find unused imports in TypeScript files.
 */
const unusedImport: SGRule = {
  id: 'unused-import',
  language: 'typescript',
  pattern: 'import { $BINDING } from "$SOURCE"',
  message: 'Potentially unused import detected. Verify usage before removing.',
  severity: 'warning',
};

/**
 * Find console.log calls that should be removed before production.
 */
const consoleLogRemoval: SGRule = {
  id: 'console-log-removal',
  language: 'typescript',
  pattern: 'console.log($$$ARGS)',
  message: 'console.log should be replaced with a proper logging mechanism.',
  fix: '',
  severity: 'warning',
};

/**
 * Find TODO and FIXME comments in code.
 */
const todoComments: SGRule = {
  id: 'todo-comments',
  language: 'typescript',
  pattern: '// TODO $$$MSG',
  message: 'TODO comment found. Track in issue tracker instead.',
  severity: 'info',
};

/**
 * Find empty function bodies that may indicate incomplete implementation.
 */
const emptyFunction: SGRule = {
  id: 'empty-function',
  language: 'typescript',
  pattern: 'function $NAME($$$PARAMS) {}',
  message: 'Empty function body detected. This may indicate incomplete implementation.',
  severity: 'warning',
};

/**
 * Find debugger statements that should not be committed.
 */
const debuggerStatement: SGRule = {
  id: 'debugger-statement',
  language: 'typescript',
  pattern: 'debugger',
  message: 'Debugger statement found. Remove before committing.',
  fix: '',
  severity: 'error',
};

// ============================================================================
// Exports
// ============================================================================

/**
 * Collection of common AST-grep presets indexed by name.
 */
export const AST_GREP_PRESETS: Record<string, SGRule> = {
  unusedImport,
  consoleLogRemoval,
  todoComments,
  emptyFunction,
  debuggerStatement,
};

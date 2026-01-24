/**
 * AST-Grep Module
 *
 * AST-based code search, transformation, and linting capabilities.
 *
 * @module core/tools/ast-grep
 */

// Interfaces and Types
export * from './ast-grep.interface.js';

// Implementation
export { ASTGrepClient } from './ast-grep-client.js';

// Tools
export { ASTSearchTool, type ASTSearchInput } from './ast-search.tool.js';
export { ASTLintTool, type ASTLintInput } from './ast-lint.tool.js';
export { ASTRewriteTool, type ASTRewriteInput } from './ast-rewrite.tool.js';

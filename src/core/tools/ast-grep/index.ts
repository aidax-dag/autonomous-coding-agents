/**
 * AST-Grep Integration Module
 *
 * Pattern-based code search and transformation via the sg CLI tool.
 *
 * @module core/tools/ast-grep
 */

export { ASTGrepClient, createASTGrepClient } from './ast-grep-client';
export type {
  ASTGrepClientConfig,
  SearchOptions,
  SearchMatch,
  SGRule,
  RewriteOptions,
  RewriteResult,
} from './ast-grep-client';
export { AST_GREP_PRESETS } from './presets';

/**
 * Tools Module
 *
 * Provides tool registry, executor, and base implementation.
 *
 * @module core/tools
 */

export { BaseTool } from './base-tool.js';
export { ToolRegistry } from './tool-registry.js';
export { ToolExecutor } from './tool-executor.js';

// Re-export interfaces for convenience
export {
  ITool,
  IToolRegistry,
  IToolExecutor,
  IToolFactory,
  ToolCategory,
  ToolSchema,
  ToolResult,
  ToolError,
  ToolCall,
  ToolExecutionOptions,
  ToolValidationResult,
  ToolExecutionRecord,
} from '../interfaces/tool.interface.js';

// Git tools
export * from './git/index.js';

// File tools
export * from './file/index.js';

// Shell tools
export * from './shell/index.js';

// AST-Grep tools
export * from './ast-grep/index.js';

// MCP tools
export * from './mcp/index.js';

// Web Search tools
export * from './web-search/index.js';

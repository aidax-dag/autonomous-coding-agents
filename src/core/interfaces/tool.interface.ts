/**
 * Tool Interfaces
 *
 * SOLID Principles:
 * - S: ITool focuses only on tool execution contract
 * - O: New tool types extend without modifying base
 * - I: Tool interfaces segregated by concern
 * - D: Consumers depend on ITool abstraction
 *
 * @module core/interfaces/tool
 */

/**
 * Tool category enumeration
 */
export enum ToolCategory {
  FILE_SYSTEM = 'file_system',
  GIT = 'git',
  SHELL = 'shell',
  LSP = 'lsp',
  AST = 'ast',
  NETWORK = 'network',
  DATABASE = 'database',
  TESTING = 'testing',
  MCP = 'mcp',
  CUSTOM = 'custom',
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
  validation?: ToolParameterValidation;
}

/**
 * Tool parameter types
 */
export type ToolParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

/**
 * Tool parameter validation rules
 */
export interface ToolParameterValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  format?: string;
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

/**
 * Tool schema definition (JSON Schema compatible)
 */
export interface ToolSchema {
  name: string;
  description: string;
  category: ToolCategory;
  version: string;
  parameters: ToolParameter[];
  returns: {
    type: ToolParameterType;
    description: string;
    schema?: Record<string, unknown>;
  };
  examples?: ToolExample[];
  tags?: string[];
}

/**
 * Tool usage example
 */
export interface ToolExample {
  description: string;
  input: Record<string, unknown>;
  output: unknown;
}

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ToolError;
  metadata: ToolResultMetadata;
}

/**
 * Tool error information
 */
export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Tool result metadata
 */
export interface ToolResultMetadata {
  toolName: string;
  executionTime: number;
  timestamp: Date;
  inputHash?: string;
  cached?: boolean;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  dryRun?: boolean;
  cache?: boolean;
  cacheTTL?: number;
  context?: Record<string, unknown>;
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  valid: boolean;
  errors: ToolValidationError[];
}

/**
 * Tool validation error
 */
export interface ToolValidationError {
  parameter: string;
  message: string;
  constraint: string;
  value?: unknown;
}

/**
 * Core Tool Interface
 *
 * Defines the contract that all tools must implement.
 *
 * @interface ITool
 */
export interface ITool<TInput = unknown, TOutput = unknown> {
  // === Identification ===
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchema;

  // === Execution ===
  /**
   * Execute the tool with given parameters
   */
  execute(params: TInput, options?: ToolExecutionOptions): Promise<ToolResult<TOutput>>;

  /**
   * Validate input parameters
   */
  validate(params: TInput): ToolValidationResult;

  // === Metadata ===
  /**
   * Get tool category
   */
  getCategory(): ToolCategory;

  /**
   * Get tool version
   */
  getVersion(): string;

  /**
   * Check if tool is available (dependencies met)
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Tool constructor type
 */
export type ToolConstructor = new () => ITool;

/**
 * Tool Registry Interface
 *
 * Manages tool registration and lookup
 */
export interface IToolRegistry {
  /**
   * Register a tool
   */
  register(tool: ITool): void;

  /**
   * Unregister a tool by name
   */
  unregister(name: string): boolean;

  /**
   * Get a tool by name
   */
  get(name: string): ITool | undefined;

  /**
   * Get all tools
   */
  getAll(): ITool[];

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ITool[];

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean;

  /**
   * Get count of registered tools
   */
  count(): number;

  /**
   * Get all tool schemas (for LLM function calling)
   */
  getSchemas(): ToolSchema[];

  /**
   * Clear all registered tools
   */
  clear(): void;
}

/**
 * Tool Executor Interface
 *
 * Handles tool execution with error handling and retries
 */
export interface IToolExecutor {
  /**
   * Execute a tool by name
   */
  execute<T>(
    toolName: string,
    params: unknown,
    options?: ToolExecutionOptions
  ): Promise<ToolResult<T>>;

  /**
   * Execute multiple tools in sequence
   */
  executeSequence(
    calls: ToolCall[]
  ): Promise<ToolResult[]>;

  /**
   * Execute multiple tools in parallel
   */
  executeParallel(
    calls: ToolCall[]
  ): Promise<ToolResult[]>;

  /**
   * Get execution history
   */
  getHistory(limit?: number): ToolExecutionRecord[];
}

/**
 * Tool call definition
 */
export interface ToolCall {
  toolName: string;
  params: unknown;
  options?: ToolExecutionOptions;
}

/**
 * Tool execution record
 */
export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  params: unknown;
  result: ToolResult;
  timestamp: Date;
  duration: number;
}

/**
 * Tool Factory Interface
 *
 * Creates tool instances
 */
export interface IToolFactory {
  /**
   * Create a tool instance
   */
  createTool(name: string, config?: Record<string, unknown>): ITool;

  /**
   * Register a tool class
   */
  registerToolClass(name: string, toolClass: ToolConstructor): void;

  /**
   * Check if tool type is registered
   */
  hasToolType(name: string): boolean;

  /**
   * Get registered tool types
   */
  getRegisteredTypes(): string[];
}

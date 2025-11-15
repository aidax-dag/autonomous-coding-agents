/**
 * Custom Error Classes
 *
 * Provides structured error handling with:
 * - Error codes for categorization
 * - Retryability indication
 * - Context metadata
 * - Stack trace capture
 * - Error type discrimination
 *
 * Feature: F1.5 - Error Handling
 */

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  // Configuration Errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',

  // LLM Errors
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_CONTEXT_LENGTH_EXCEEDED = 'LLM_CONTEXT_LENGTH_EXCEEDED',

  // GitHub Errors
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  GITHUB_AUTH_ERROR = 'GITHUB_AUTH_ERROR',
  GITHUB_NOT_FOUND = 'GITHUB_NOT_FOUND',
  GITHUB_RATE_LIMIT = 'GITHUB_RATE_LIMIT',
  GITHUB_CONFLICT = 'GITHUB_CONFLICT',

  // Git Errors
  GIT_OPERATION_FAILED = 'GIT_OPERATION_FAILED',
  GIT_MERGE_CONFLICT = 'GIT_MERGE_CONFLICT',
  GIT_AUTHENTICATION_FAILED = 'GIT_AUTHENTICATION_FAILED',

  // NATS/Messaging Errors
  MESSAGE_BROKER_ERROR = 'MESSAGE_BROKER_ERROR',
  MESSAGE_VALIDATION_ERROR = 'MESSAGE_VALIDATION_ERROR',
  MESSAGE_TIMEOUT = 'MESSAGE_TIMEOUT',

  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',

  // Agent Errors
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_STATE_ERROR = 'AGENT_STATE_ERROR',
  AGENT_INITIALIZATION_ERROR = 'AGENT_INITIALIZATION_ERROR',
  AGENT_COMMUNICATION_ERROR = 'AGENT_COMMUNICATION_ERROR',

  // Implementation Errors
  IMPLEMENTATION_FAILED = 'IMPLEMENTATION_FAILED',
  IMPLEMENTATION_TIMEOUT = 'IMPLEMENTATION_TIMEOUT',
  IMPLEMENTATION_MAX_TURNS_EXCEEDED = 'IMPLEMENTATION_MAX_TURNS_EXCEEDED',

  // Review Errors
  REVIEW_FAILED = 'REVIEW_FAILED',
  REVIEW_TIMEOUT = 'REVIEW_TIMEOUT',

  // Workflow Errors
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  WORKFLOW_TIMEOUT = 'WORKFLOW_TIMEOUT',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',

  // Generic Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Base Agent Error class
 */
export class AgentError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: ErrorCode,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = Date.now();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Get error details as string
   */
  toString(): string {
    const contextStr = this.context ? ` | Context: ${JSON.stringify(this.context)}` : '';
    return `[${this.code}] ${this.message}${contextStr}`;
  }
}

/**
 * Configuration Error
 */
export class ConfigError extends AgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCode.CONFIG_INVALID, false, context);
  }
}

/**
 * LLM API Error
 */
export class LLMError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.LLM_API_ERROR,
    retryable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, code, retryable, context);
  }
}

/**
 * LLM Rate Limit Error
 */
export class LLMRateLimitError extends LLMError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, context?: Record<string, unknown>) {
    super(
      message,
      ErrorCode.LLM_RATE_LIMIT,
      true,
      { ...context, retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * LLM Timeout Error
 */
export class LLMTimeoutError extends LLMError {
  constructor(message: string, timeoutMs: number, context?: Record<string, unknown>) {
    super(
      message,
      ErrorCode.LLM_TIMEOUT,
      true,
      { ...context, timeoutMs }
    );
  }
}

/**
 * GitHub API Error
 */
export class GitHubError extends AgentError {
  public readonly statusCode?: number;

  constructor(
    message: string,
    statusCode?: number,
    code: ErrorCode = ErrorCode.GITHUB_API_ERROR,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, code, retryable, { ...context, statusCode });
    this.statusCode = statusCode;
  }
}

/**
 * GitHub Rate Limit Error
 */
export class GitHubRateLimitError extends GitHubError {
  public readonly resetAt?: number;

  constructor(message: string, resetAt?: number, context?: Record<string, unknown>) {
    super(
      message,
      429,
      ErrorCode.GITHUB_RATE_LIMIT,
      true,
      { ...context, resetAt }
    );
    this.resetAt = resetAt;
  }
}

/**
 * GitHub Not Found Error
 */
export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string, context?: Record<string, unknown>) {
    super(
      `GitHub resource not found: ${resource}`,
      404,
      ErrorCode.GITHUB_NOT_FOUND,
      false,
      { ...context, resource }
    );
  }
}

/**
 * GitHub Authentication Error
 */
export class GitHubAuthenticationError extends GitHubError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 401, ErrorCode.GITHUB_AUTH_ERROR, false, context);
  }
}

/**
 * GitHub Validation Error
 */
export class GitHubValidationError extends GitHubError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 422, ErrorCode.VALIDATION_ERROR, false, context);
  }
}

/**
 * Git Operation Error
 */
export class GitError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.GIT_OPERATION_FAILED,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, code, retryable, context);
  }
}

/**
 * Git Merge Conflict Error
 */
export class GitMergeConflictError extends GitError {
  public readonly conflictingFiles: string[];

  constructor(message: string, conflictingFiles: string[], context?: Record<string, unknown>) {
    super(
      message,
      ErrorCode.GIT_MERGE_CONFLICT,
      false,
      { ...context, conflictingFiles }
    );
    this.conflictingFiles = conflictingFiles;
  }
}

/**
 * Git Authentication Error
 */
export class GitAuthenticationError extends GitError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCode.GIT_AUTHENTICATION_FAILED, false, context);
  }
}

/**
 * Message Broker Error
 */
export class MessageBrokerError extends AgentError {
  constructor(
    message: string,
    retryable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCode.MESSAGE_BROKER_ERROR, retryable, context);
  }
}

/**
 * Message Validation Error
 */
export class MessageValidationError extends AgentError {
  public readonly validationErrors: string[];

  constructor(validationErrors: string[], context?: Record<string, unknown>) {
    super(
      `Message validation failed: ${validationErrors.join(', ')}`,
      ErrorCode.MESSAGE_VALIDATION_ERROR,
      false,
      { ...context, validationErrors }
    );
    this.validationErrors = validationErrors;
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DATABASE_ERROR,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, code, retryable, context);
  }
}

/**
 * Agent Timeout Error
 */
export class AgentTimeoutError extends AgentError {
  constructor(
    agentType: string,
    timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Agent ${agentType} timed out after ${timeoutMs}ms`,
      ErrorCode.AGENT_TIMEOUT,
      false,
      { ...context, agentType, timeoutMs }
    );
  }
}

/**
 * Implementation Error
 */
export class ImplementationError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.IMPLEMENTATION_FAILED,
    retryable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, code, retryable, context);
  }
}

/**
 * Max Turns Exceeded Error
 */
export class MaxTurnsExceededError extends ImplementationError {
  constructor(currentTurns: number, maxTurns: number, context?: Record<string, unknown>) {
    super(
      `Implementation exceeded maximum turns (${currentTurns}/${maxTurns})`,
      ErrorCode.IMPLEMENTATION_MAX_TURNS_EXCEEDED,
      false,
      { ...context, currentTurns, maxTurns }
    );
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AgentError {
  public readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      false,
      { ...context, field }
    );
    this.field = field;
  }
}

/**
 * Type guard to check if error is AgentError
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isAgentError(error) && error.retryable;
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isAgentError(error)) {
    return error.code;
  }
  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Wrap unknown error as AgentError
 */
export function wrapError(
  error: unknown,
  message?: string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR
): AgentError {
  if (isAgentError(error)) {
    return error;
  }

  const errorMessage = message || (error instanceof Error ? error.message : String(error));
  const context: Record<string, unknown> = {};

  if (error instanceof Error) {
    context.originalError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else {
    context.originalError = error;
  }

  return new AgentError(errorMessage, code, false, context);
}

/**
 * Create error from HTTP response
 */
export function createHTTPError(
  statusCode: number,
  message: string,
  context?: Record<string, unknown>
): AgentError {
  // Map status codes to error types
  if (statusCode === 429) {
    return new GitHubRateLimitError(message, undefined, context);
  } else if (statusCode === 404) {
    return new GitHubNotFoundError(message, context);
  } else if (statusCode >= 500) {
    return new GitHubError(message, statusCode, ErrorCode.GITHUB_API_ERROR, true, context);
  } else {
    return new GitHubError(message, statusCode, ErrorCode.GITHUB_API_ERROR, false, context);
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

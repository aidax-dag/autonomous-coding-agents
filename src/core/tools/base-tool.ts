/**
 * Base Tool Implementation
 *
 * Abstract base class for implementing tools with common functionality.
 *
 * @module core/tools/base-tool
 */

import {
  ITool,
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
  ToolValidationResult,
  ToolValidationError,
  ToolParameter,
} from '../interfaces/tool.interface.js';

/**
 * Abstract base class for tools
 *
 * Provides common functionality for tool implementations:
 * - Parameter validation
 * - Result formatting
 * - Error handling
 *
 * @abstract
 */
export abstract class BaseTool<TInput = unknown, TOutput = unknown>
  implements ITool<TInput, TOutput>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly schema: ToolSchema;

  /**
   * Execute the tool - must be implemented by subclasses
   */
  abstract execute(
    params: TInput,
    options?: ToolExecutionOptions
  ): Promise<ToolResult<TOutput>>;

  /**
   * Validate input parameters against schema
   */
  validate(params: TInput): ToolValidationResult {
    const errors: ToolValidationError[] = [];
    const input = params as Record<string, unknown>;

    for (const param of this.schema.parameters) {
      const value = input[param.name];

      // Check required
      if (param.required && (value === undefined || value === null)) {
        errors.push({
          parameter: param.name,
          message: `Required parameter '${param.name}' is missing`,
          constraint: 'required',
        });
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const typeError = this.validateType(param, value);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      // Constraint validation
      const constraintErrors = this.validateConstraints(param, value);
      errors.push(...constraintErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get tool category
   */
  getCategory(): ToolCategory {
    return this.schema.category;
  }

  /**
   * Get tool version
   */
  getVersion(): string {
    return this.schema.version;
  }

  /**
   * Check if tool is available - can be overridden
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Create a successful result
   */
  protected success<T>(data: T, executionTime: number): ToolResult<T> {
    return {
      success: true,
      data,
      metadata: {
        toolName: this.name,
        executionTime,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Create a failure result
   */
  protected failure<T>(
    code: string,
    message: string,
    executionTime: number,
    details?: Record<string, unknown>,
    recoverable = true
  ): ToolResult<T> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        recoverable,
      },
      metadata: {
        toolName: this.name,
        executionTime,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Validate parameter type
   */
  private validateType(
    param: ToolParameter,
    value: unknown
  ): ToolValidationError | null {
    const actualType = this.getActualType(value);

    if (actualType !== param.type) {
      return {
        parameter: param.name,
        message: `Expected type '${param.type}', got '${actualType}'`,
        constraint: 'type',
        value,
      };
    }

    return null;
  }

  /**
   * Validate parameter constraints
   */
  private validateConstraints(
    param: ToolParameter,
    value: unknown
  ): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const validation = param.validation;

    if (!validation) {
      return errors;
    }

    // String constraints
    if (param.type === 'string' && typeof value === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors.push({
          parameter: param.name,
          message: `String length must be at least ${validation.minLength}`,
          constraint: 'minLength',
          value,
        });
      }

      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors.push({
          parameter: param.name,
          message: `String length must be at most ${validation.maxLength}`,
          constraint: 'maxLength',
          value,
        });
      }

      if (validation.pattern !== undefined) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            parameter: param.name,
            message: `String must match pattern '${validation.pattern}'`,
            constraint: 'pattern',
            value,
          });
        }
      }
    }

    // Number constraints
    if (param.type === 'number' && typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          parameter: param.name,
          message: `Value must be at least ${validation.min}`,
          constraint: 'min',
          value,
        });
      }

      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          parameter: param.name,
          message: `Value must be at most ${validation.max}`,
          constraint: 'max',
          value,
        });
      }
    }

    // Enum constraints
    if (param.enum !== undefined && !param.enum.includes(value)) {
      errors.push({
        parameter: param.name,
        message: `Value must be one of: ${param.enum.join(', ')}`,
        constraint: 'enum',
        value,
      });
    }

    return errors;
  }

  /**
   * Get actual JavaScript type
   */
  private getActualType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

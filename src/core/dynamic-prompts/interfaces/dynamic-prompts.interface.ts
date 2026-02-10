/**
 * Dynamic Prompts Interfaces
 *
 * Defines abstractions for runtime prompt optimization
 * and template-based prompt construction.
 *
 * @module core/dynamic-prompts/interfaces
 */

/**
 * Prompt template with variable slots
 */
export interface PromptTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template content with {{variable}} placeholders */
  content: string;
  /** Required variables */
  requiredVars: string[];
  /** Optional variables with defaults */
  optionalVars: Record<string, string>;
  /** Template category */
  category: 'system' | 'task' | 'review' | 'planning' | 'custom';
  /** Priority for template selection (higher = preferred) */
  priority: number;
}

/**
 * Prompt context for variable resolution
 */
export interface PromptContext {
  /** Variable values */
  variables: Record<string, string>;
  /** Agent type requesting the prompt */
  agentType?: string;
  /** Task complexity (0-1) */
  complexity?: number;
  /** Token budget constraint */
  maxTokens?: number;
}

/**
 * Rendered prompt
 */
export interface RenderedPrompt {
  /** Rendered content */
  content: string;
  /** Template used */
  templateId: string;
  /** Variables that were applied */
  appliedVars: Record<string, string>;
  /** Estimated token count */
  estimatedTokens: number;
  /** Render timestamp */
  renderedAt: string;
}

/**
 * Prompt registry interface
 */
export interface IPromptRegistry {
  /** Register a template */
  register(template: PromptTemplate): void;

  /** Get template by ID */
  get(id: string): PromptTemplate | undefined;

  /** Find templates by category */
  findByCategory(category: PromptTemplate['category']): PromptTemplate[];

  /** List all template IDs */
  list(): string[];

  /** Remove a template */
  remove(id: string): boolean;
}

/**
 * Prompt renderer interface
 */
export interface IPromptRenderer {
  /** Render a template with context */
  render(templateId: string, context: PromptContext): RenderedPrompt;

  /** Select best template for context */
  selectTemplate(category: PromptTemplate['category'], context: PromptContext): PromptTemplate | undefined;
}

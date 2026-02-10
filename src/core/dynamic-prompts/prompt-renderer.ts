/**
 * Prompt Renderer
 *
 * Renders prompt templates with variable substitution
 * and selects optimal templates based on context.
 *
 * @module core/dynamic-prompts
 */

import type {
  IPromptRenderer,
  IPromptRegistry,
  PromptTemplate,
  PromptContext,
  RenderedPrompt,
} from './interfaces/dynamic-prompts.interface';

/**
 * Prompt renderer config
 */
export interface PromptRendererConfig {
  /** Template registry */
  registry: IPromptRegistry;
  /** Approximate tokens per character (default: 0.25) */
  tokensPerChar?: number;
}

/**
 * Prompt renderer implementation
 */
export class PromptRenderer implements IPromptRenderer {
  private readonly registry: IPromptRegistry;
  private readonly tokensPerChar: number;

  constructor(config: PromptRendererConfig) {
    this.registry = config.registry;
    this.tokensPerChar = config.tokensPerChar ?? 0.25;
  }

  render(templateId: string, context: PromptContext): RenderedPrompt {
    const template = this.registry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.renderTemplate(template, context);
  }

  selectTemplate(
    category: PromptTemplate['category'],
    context: PromptContext,
  ): PromptTemplate | undefined {
    const candidates = this.registry.findByCategory(category);
    if (candidates.length === 0) return undefined;

    // Filter by token budget if specified
    if (context.maxTokens) {
      const fitting = candidates.find((t) => {
        const estimated = this.estimateTokens(t.content);
        return estimated <= context.maxTokens!;
      });
      if (fitting) return fitting;
    }

    // Return highest priority
    return candidates[0];
  }

  private renderTemplate(
    template: PromptTemplate,
    context: PromptContext,
  ): RenderedPrompt {
    const appliedVars: Record<string, string> = {};
    let content = template.content;

    // Apply required variables
    for (const varName of template.requiredVars) {
      const value = context.variables[varName];
      if (value === undefined) {
        throw new Error(
          `Missing required variable '${varName}' for template '${template.id}'`,
        );
      }
      content = content.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
      appliedVars[varName] = value;
    }

    // Apply optional variables (with defaults)
    for (const [varName, defaultValue] of Object.entries(template.optionalVars)) {
      const value = context.variables[varName] ?? defaultValue;
      content = content.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
      appliedVars[varName] = value;
    }

    // Truncate if over token budget
    if (context.maxTokens) {
      const maxChars = Math.floor(context.maxTokens / this.tokensPerChar);
      if (content.length > maxChars) {
        content = content.slice(0, maxChars) + '\n[truncated]';
      }
    }

    return {
      content,
      templateId: template.id,
      appliedVars,
      estimatedTokens: this.estimateTokens(content),
      renderedAt: new Date().toISOString(),
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }
}

/**
 * Factory function
 */
export function createPromptRenderer(config: PromptRendererConfig): PromptRenderer {
  return new PromptRenderer(config);
}

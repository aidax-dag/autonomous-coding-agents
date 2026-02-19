/**
 * Prompt Registry
 *
 * In-memory registry for prompt templates with category-based lookup.
 *
 * @module core/dynamic-prompts
 */

import type { IPromptRegistry, PromptTemplate } from './interfaces/dynamic-prompts.interface';

/**
 * Prompt registry implementation
 */
export class PromptRegistry implements IPromptRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.templates.set(template.id, { ...template });
  }

  get(id: string): PromptTemplate | undefined {
    const template = this.templates.get(id);
    return template ? { ...template } : undefined;
  }

  findByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter((template) => template.category === category)
      .sort((leftTemplate, rightTemplate) => rightTemplate.priority - leftTemplate.priority)
      .map((template) => ({ ...template }));
  }

  list(): string[] {
    return Array.from(this.templates.keys());
  }

  remove(id: string): boolean {
    return this.templates.delete(id);
  }
}

/**
 * Factory function
 */
export function createPromptRegistry(): PromptRegistry {
  return new PromptRegistry();
}

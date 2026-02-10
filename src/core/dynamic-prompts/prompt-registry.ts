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
    const t = this.templates.get(id);
    return t ? { ...t } : undefined;
  }

  findByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter((t) => t.category === category)
      .sort((a, b) => b.priority - a.priority)
      .map((t) => ({ ...t }));
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

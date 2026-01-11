/**
 * Tool Registry Implementation
 *
 * Manages tool registration, lookup, and lifecycle.
 *
 * @module core/tools/tool-registry
 */

import {
  ITool,
  IToolRegistry,
  ToolCategory,
  ToolSchema,
} from '../interfaces/tool.interface.js';

/**
 * Tool Registry Implementation
 *
 * Provides centralized management of tools with:
 * - Registration and unregistration
 * - Category-based lookup
 * - Schema extraction for LLM function calling
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, ITool>();
  private readonly categoryIndex = new Map<ToolCategory, Set<string>>();

  /**
   * Register a tool
   *
   * @throws Error if tool with same name already exists
   */
  register(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, tool);
    this.addToIndex(tool);
  }

  /**
   * Unregister a tool by name
   *
   * @returns true if tool was unregistered, false if not found
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);
    this.removeFromIndex(tool);
    return true;
  }

  /**
   * Get a tool by name
   */
  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ITool[] {
    const names = this.categoryIndex.get(category);
    if (!names) {
      return [];
    }

    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is ITool => tool !== undefined);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get count of registered tools
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Get all tool schemas (for LLM function calling)
   */
  getSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map((tool) => tool.schema);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.categoryIndex.clear();
  }

  /**
   * Get available tools (check isAvailable)
   */
  async getAvailable(): Promise<ITool[]> {
    const tools = this.getAll();
    const results = await Promise.all(
      tools.map(async (tool) => ({
        tool,
        available: await tool.isAvailable(),
      }))
    );

    return results.filter((r) => r.available).map((r) => r.tool);
  }

  /**
   * Search tools by name or description
   */
  search(query: string): ITool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.schema.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Add tool to category index
   */
  private addToIndex(tool: ITool): void {
    const category = tool.getCategory();
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category)!.add(tool.name);
  }

  /**
   * Remove tool from category index
   */
  private removeFromIndex(tool: ITool): void {
    const category = tool.getCategory();
    const categoryTools = this.categoryIndex.get(category);
    if (categoryTools) {
      categoryTools.delete(tool.name);
      if (categoryTools.size === 0) {
        this.categoryIndex.delete(category);
      }
    }
  }
}

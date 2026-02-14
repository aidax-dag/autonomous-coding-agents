/**
 * IDE Command Registry
 *
 * Manages available commands with metadata for IDE integration.
 * Provides registration, lookup, and listing of command definitions
 * with associated handlers.
 *
 * @module ui/ide
 */

import type { CommandHandler } from './ide-bridge';

/**
 * Parameter definition for a command
 */
export interface ParamDefinition {
  type: string;
  required: boolean;
  description: string;
}

/**
 * Full command definition with metadata
 */
export interface CommandDefinition {
  method: string;
  description: string;
  params?: Record<string, ParamDefinition>;
  returns?: string;
}

/**
 * Internal entry pairing a definition with its handler
 */
interface CommandEntry {
  definition: CommandDefinition;
  handler: CommandHandler;
}

/**
 * IDECommandRegistry
 *
 * Stores command definitions alongside their handlers.
 * Supports registration, unregistration, lookup, and enumeration.
 */
export class IDECommandRegistry {
  private commands: Map<string, CommandEntry> = new Map();

  /**
   * Register a command with its definition and handler.
   * Overwrites any existing command with the same method name.
   */
  register(definition: CommandDefinition, handler: CommandHandler): void {
    this.commands.set(definition.method, { definition, handler });
  }

  /**
   * Unregister a command by method name.
   * Returns true if the command existed and was removed, false otherwise.
   */
  unregister(method: string): boolean {
    return this.commands.delete(method);
  }

  /**
   * Get the handler for a specific command method.
   * Returns undefined if no command is registered with that name.
   */
  getHandler(method: string): CommandHandler | undefined {
    return this.commands.get(method)?.handler;
  }

  /**
   * List all registered command definitions.
   */
  listCommands(): CommandDefinition[] {
    return Array.from(this.commands.values()).map((entry) => entry.definition);
  }

  /**
   * Check whether a command is registered.
   */
  hasCommand(method: string): boolean {
    return this.commands.has(method);
  }
}

/**
 * Factory function for creating an IDECommandRegistry
 */
export function createIDECommandRegistry(): IDECommandRegistry {
  return new IDECommandRegistry();
}

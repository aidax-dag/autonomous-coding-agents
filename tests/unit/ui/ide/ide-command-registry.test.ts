/**
 * IDE Command Registry Tests
 *
 * Tests for command registration, lookup, and management.
 *
 * Feature: E-3 IDE Integration
 */

import {
  IDECommandRegistry,
  createIDECommandRegistry,
  type CommandDefinition,
} from '@/ui/ide/ide-command-registry';

describe('IDECommandRegistry', () => {
  let registry: IDECommandRegistry;

  beforeEach(() => {
    registry = new IDECommandRegistry();
  });

  // ── Registration ───────────────────────────────────────────────

  describe('register', () => {
    it('should register a command with definition and handler', () => {
      const definition: CommandDefinition = {
        method: 'doSomething',
        description: 'Does something useful',
        params: {
          input: { type: 'string', required: true, description: 'The input value' },
        },
        returns: 'object',
      };
      const handler = jest.fn();

      registry.register(definition, handler);

      expect(registry.hasCommand('doSomething')).toBe(true);
      expect(registry.getHandler('doSomething')).toBe(handler);
    });

    it('should overwrite an existing command with the same method', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      registry.register(
        { method: 'cmd', description: 'First version' },
        handler1,
      );
      registry.register(
        { method: 'cmd', description: 'Second version' },
        handler2,
      );

      expect(registry.getHandler('cmd')).toBe(handler2);
      // Should only have one command, not two
      expect(registry.listCommands()).toHaveLength(1);
      expect(registry.listCommands()[0].description).toBe('Second version');
    });

    it('should register multiple distinct commands', () => {
      registry.register({ method: 'a', description: 'Command A' }, jest.fn());
      registry.register({ method: 'b', description: 'Command B' }, jest.fn());
      registry.register({ method: 'c', description: 'Command C' }, jest.fn());

      expect(registry.listCommands()).toHaveLength(3);
    });
  });

  // ── Unregistration ─────────────────────────────────────────────

  describe('unregister', () => {
    it('should remove an existing command and return true', () => {
      registry.register({ method: 'cmd', description: 'test' }, jest.fn());

      const result = registry.unregister('cmd');

      expect(result).toBe(true);
      expect(registry.hasCommand('cmd')).toBe(false);
      expect(registry.getHandler('cmd')).toBeUndefined();
    });

    it('should return false for a non-existent command', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('should not affect other registered commands', () => {
      registry.register({ method: 'keep', description: 'keep' }, jest.fn());
      registry.register({ method: 'remove', description: 'remove' }, jest.fn());

      registry.unregister('remove');

      expect(registry.hasCommand('keep')).toBe(true);
      expect(registry.hasCommand('remove')).toBe(false);
      expect(registry.listCommands()).toHaveLength(1);
    });
  });

  // ── Lookup ─────────────────────────────────────────────────────

  describe('getHandler', () => {
    it('should return the handler for a registered command', () => {
      const handler = jest.fn();
      registry.register({ method: 'test', description: 'test' }, handler);

      expect(registry.getHandler('test')).toBe(handler);
    });

    it('should return undefined for an unregistered command', () => {
      expect(registry.getHandler('missing')).toBeUndefined();
    });
  });

  describe('hasCommand', () => {
    it('should return true for registered command', () => {
      registry.register({ method: 'exists', description: 'yes' }, jest.fn());
      expect(registry.hasCommand('exists')).toBe(true);
    });

    it('should return false for unregistered command', () => {
      expect(registry.hasCommand('nope')).toBe(false);
    });
  });

  // ── Listing ────────────────────────────────────────────────────

  describe('listCommands', () => {
    it('should return empty array when no commands registered', () => {
      expect(registry.listCommands()).toEqual([]);
    });

    it('should return all registered command definitions', () => {
      const defA: CommandDefinition = {
        method: 'alpha',
        description: 'First command',
        params: {
          name: { type: 'string', required: true, description: 'Name param' },
        },
        returns: 'string',
      };
      const defB: CommandDefinition = {
        method: 'beta',
        description: 'Second command',
      };

      registry.register(defA, jest.fn());
      registry.register(defB, jest.fn());

      const commands = registry.listCommands();
      expect(commands).toHaveLength(2);
      expect(commands).toEqual(
        expect.arrayContaining([defA, defB]),
      );
    });

    it('should not include handlers in the returned definitions', () => {
      registry.register({ method: 'test', description: 'test' }, jest.fn());

      const commands = registry.listCommands();
      for (const cmd of commands) {
        expect(cmd).not.toHaveProperty('handler');
      }
    });
  });

  // ── Factory Function ───────────────────────────────────────────

  describe('createIDECommandRegistry', () => {
    it('should create an IDECommandRegistry instance', () => {
      const instance = createIDECommandRegistry();
      expect(instance).toBeInstanceOf(IDECommandRegistry);
    });

    it('should create an empty registry', () => {
      const instance = createIDECommandRegistry();
      expect(instance.listCommands()).toEqual([]);
    });
  });
});

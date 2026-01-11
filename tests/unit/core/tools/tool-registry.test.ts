/**
 * Tool Registry Tests
 */

import { ToolRegistry, BaseTool } from '../../../../src/core/tools';
import {
  ToolCategory,
  ToolSchema,
  ToolResult,
  ToolExecutionOptions,
} from '../../../../src/core/interfaces/tool.interface';

/**
 * Mock tool for testing
 */
class MockTool extends BaseTool<{ input: string }, string> {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchema;

  constructor(
    name: string,
    category: ToolCategory = ToolCategory.FILE_SYSTEM,
    tags: string[] = []
  ) {
    super();
    this.name = name;
    this.description = `Description for ${name}`;
    this.schema = {
      name: this.name,
      description: this.description,
      category,
      version: '1.0.0',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'Input value',
          required: true,
        },
      ],
      returns: {
        type: 'string',
        description: 'Output value',
      },
      tags,
    };
  }

  async execute(
    params: { input: string },
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<string>> {
    return this.success(`Executed with: ${params.input}`, 100);
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Registration', () => {
    it('should register a tool', () => {
      const tool = new MockTool('test-tool');

      registry.register(tool);

      expect(registry.has('test-tool')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should throw when registering duplicate name', () => {
      const tool1 = new MockTool('test-tool');
      const tool2 = new MockTool('test-tool');

      registry.register(tool1);

      expect(() => registry.register(tool2)).toThrow(
        "Tool 'test-tool' is already registered"
      );
    });

    it('should register multiple tools', () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('tool-2'));
      registry.register(new MockTool('tool-3'));

      expect(registry.count()).toBe(3);
    });
  });

  describe('Unregistration', () => {
    it('should unregister a tool', () => {
      const tool = new MockTool('test-tool');

      registry.register(tool);
      expect(registry.unregister('test-tool')).toBe(true);
      expect(registry.has('test-tool')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should update category index on unregistration', () => {
      const tool = new MockTool('file-tool', ToolCategory.FILE_SYSTEM);

      registry.register(tool);
      expect(registry.getByCategory(ToolCategory.FILE_SYSTEM)).toHaveLength(1);

      registry.unregister('file-tool');
      expect(registry.getByCategory(ToolCategory.FILE_SYSTEM)).toHaveLength(0);
    });
  });

  describe('Lookup', () => {
    beforeEach(() => {
      registry.register(new MockTool('file-tool-1', ToolCategory.FILE_SYSTEM));
      registry.register(new MockTool('file-tool-2', ToolCategory.FILE_SYSTEM));
      registry.register(new MockTool('git-tool-1', ToolCategory.GIT));
    });

    it('should get tool by name', () => {
      const tool = registry.get('file-tool-1');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('file-tool-1');
    });

    it('should return undefined for unknown name', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should get tools by category', () => {
      const fileTools = registry.getByCategory(ToolCategory.FILE_SYSTEM);

      expect(fileTools).toHaveLength(2);
      expect(fileTools.map((t) => t.name)).toContain('file-tool-1');
      expect(fileTools.map((t) => t.name)).toContain('file-tool-2');
    });

    it('should return empty array for unregistered category', () => {
      const shellTools = registry.getByCategory(ToolCategory.SHELL);
      expect(shellTools).toHaveLength(0);
    });

    it('should get all tools', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('should check if tool exists', () => {
      expect(registry.has('file-tool-1')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('getSchemas', () => {
    it('should return all tool schemas', () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('tool-2'));

      const schemas = registry.getSchemas();

      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('tool-1');
      expect(schemas[1].name).toBe('tool-2');
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.getSchemas()).toHaveLength(0);
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      registry.register(new MockTool('file-reader', ToolCategory.FILE_SYSTEM, ['read', 'io']));
      registry.register(new MockTool('file-writer', ToolCategory.FILE_SYSTEM, ['write', 'io']));
      registry.register(new MockTool('git-commit', ToolCategory.GIT, ['commit', 'vcs']));
    });

    it('should search by name', () => {
      const results = registry.search('file');

      expect(results).toHaveLength(2);
      expect(results.map((t) => t.name)).toContain('file-reader');
      expect(results.map((t) => t.name)).toContain('file-writer');
    });

    it('should search by description', () => {
      const results = registry.search('Description');

      expect(results).toHaveLength(3);
    });

    it('should search by tag', () => {
      const results = registry.search('vcs');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('git-commit');
    });

    it('should return empty array when no match', () => {
      const results = registry.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const results = registry.search('FILE');

      expect(results).toHaveLength(2);
    });
  });

  describe('Clear', () => {
    it('should clear all tools', () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('tool-2'));

      registry.clear();

      expect(registry.count()).toBe(0);
    });
  });

  describe('getAvailable', () => {
    it('should return available tools', async () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('tool-2'));

      const available = await registry.getAvailable();

      expect(available).toHaveLength(2);
    });
  });
});
